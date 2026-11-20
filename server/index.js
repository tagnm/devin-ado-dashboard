import 'dotenv/config'
import express from 'express'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 3000

const ADO_ORG = process.env.ADO_ORG
const ADO_PROJECT = process.env.ADO_PROJECT
const ADO_REPO_NAME = process.env.ADO_REPO_NAME
const ADO_PAT = process.env.ADO_PAT
const API_VERSION = process.env.ADO_API_VERSION || '7.1'

const authHeader = `Basic ${Buffer.from(`:${ADO_PAT}`).toString('base64')}`
const wiqlFilter = process.env.ADO_WIQL_FILTER || ''

let cache = null
let cacheAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_DASHBOARD_CONFIG = {
  metrics: {
    workItems: { greenMax: 20, amberMax: 30 },
    activeItems: { greenMax: 10, amberMax: 15 },
    openPullRequests: { greenMax: 3, amberMax: 7 },
  },
}

function validThresholds(value) {
  return Number.isFinite(value?.greenMax) &&
    Number.isFinite(value?.amberMax) &&
    value.greenMax >= 0 &&
    value.amberMax >= value.greenMax
}

async function readDashboardConfig() {
  try {
    const localConfig = JSON.parse(
      await readFile(path.join(__dirname, '..', 'dashboard.config.json'), 'utf8'),
    )
    const metrics = localConfig?.metrics || {}
    return {
      metrics: Object.fromEntries(
        Object.entries(DEFAULT_DASHBOARD_CONFIG.metrics).map(([key, defaults]) => [
          key,
          validThresholds(metrics[key]) ? metrics[key] : defaults,
        ]),
      ),
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Could not load dashboard.config.json: ${error.message}`)
    }
    return DEFAULT_DASHBOARD_CONFIG
  }
}

async function adoFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: authHeader,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO ${res.status} from ${url}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

let targetRepoId = null

async function getTargetRepoId() {
  if (targetRepoId) return targetRepoId
  const repoUrl = `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ADO_PROJECT)}/_apis/git/repositories/${encodeURIComponent(ADO_REPO_NAME)}?api-version=${API_VERSION}`
  const repo = await adoFetch(repoUrl, { signal: AbortSignal.timeout(15000) })
  targetRepoId = repo.id
  return targetRepoId
}

function mapPrStatus(pr) {
  if (pr.isDraft) return 'draft'
  switch (pr.status) {
    case 'completed':
      return 'merged'
    case 'abandoned':
      return 'abandoned'
    case 'active':
    default:
      return 'open'
  }
}

function sessionStatusFromPrStatus(pr) {
  const status = mapPrStatus(pr)
  return status === 'open' || status === 'draft' ? 'active' : 'closed'
}

function extractSessions(pr) {
  const description = pr.description || ''
  const startedAt = pr.creationDate || new Date().toISOString()
  const status = sessionStatusFromPrStatus(pr)
  const sessionRe =
    /https:\/\/app\.devin\.ai\/sessions\/([0-9a-f]{32})/g
  const sessions = new Map()

  let match
  while ((match = sessionRe.exec(description)) !== null) {
    const uuid = match[1]
    sessions.set(uuid, {
      id: `devin-${uuid.slice(0, 8)}`,
      kind: 'cloud',
      url: `https://app.devin.ai/sessions/${uuid}`,
      startedAt,
      status,
    })
  }

  return [...sessions.values()]
}

app.get('/api/dashboard-config', async (_req, res) => {
  res.json(await readDashboardConfig())
})

app.get('/api/workitems', async (req, res) => {
  if (!ADO_ORG || !ADO_PROJECT || !ADO_REPO_NAME || !ADO_PAT) {
    return res.status(500).json({
      error: 'Missing ADO_ORG, ADO_PROJECT, ADO_REPO_NAME or ADO_PAT env vars',
    })
  }

  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return res.json(cache)
  }

  try {
    const targetRepoId = await getTargetRepoId()
    const wiqlUrl = `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ADO_PROJECT)}/_apis/wit/wiql?api-version=${API_VERSION}`
    const wiql = await adoFetch(wiqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        query: `SELECT [System.Id], [System.Title], [System.State] FROM workitems WHERE [System.AssignedTo] = @Me AND [System.State] <> 'Closed'${wiqlFilter ? ` ${wiqlFilter}` : ''}`,
      }),
    })

    const ids = wiql.workItems?.map((w) => w.id) || []
    if (ids.length === 0) {
      return res.json([])
    }

    const idsParam = ids.slice(0, 200).join(',')
    const wiUrl = `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ADO_PROJECT)}/_apis/wit/workitems?ids=${idsParam}&$expand=Relations&api-version=${API_VERSION}`
    const wiData = await adoFetch(wiUrl, { signal: AbortSignal.timeout(30000) })

    const workItems = []
    const prRefsByWorkItem = {}
    const allPrRefs = new Map()

    for (const wi of wiData.value) {
      const item = {
        id: wi.id,
        title: wi.fields['System.Title'],
        state: wi.fields['System.State'],
        type: wi.fields['System.WorkItemType'],
        url: `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ADO_PROJECT)}/_workitems/edit/${wi.id}`,
        sessions: [],
        pullRequests: [],
      }
      workItems.push(item)

      const prRelations =
        wi.relations?.filter(
          (r) => r.rel === 'ArtifactLink' && r.url?.includes('PullRequestId'),
        ) || []

      for (const rel of prRelations) {
        const decoded = decodeURIComponent(rel.url)
        const parts = decoded.split('/')
        const prId = parts[parts.length - 1]
        const repoId = parts[parts.length - 2]
        const projectId = parts[parts.length - 3]
        if (
          !prId ||
          !/^\d+$/.test(prId) ||
          !repoId ||
          !projectId ||
          repoId !== targetRepoId
        ) {
          continue
        }
        const ref = { projectId, repoId, prId, key: `${projectId}:${repoId}:${prId}` }
        allPrRefs.set(ref.key, ref)
        if (!prRefsByWorkItem[wi.id]) prRefsByWorkItem[wi.id] = []
        prRefsByWorkItem[wi.id].push(ref)
      }
    }

    const prDetails = {}
    const uniquePrRefs = [...allPrRefs.values()]
    for (let i = 0; i < uniquePrRefs.length; i += 8) {
      await Promise.all(
        uniquePrRefs.slice(i, i + 8).map(async (ref) => {
          const prUrl = `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ref.projectId)}/_apis/git/repositories/${encodeURIComponent(ref.repoId)}/pullrequests/${ref.prId}?api-version=${API_VERSION}`
          try {
            const pr = await adoFetch(prUrl, {
              signal: AbortSignal.timeout(15000),
            })
            prDetails[ref.key] = pr
          } catch (err) {
            console.warn(
              `Could not fetch PR ${ref.prId} in ${ref.projectId}/${ref.repoId}: ${err.message}`,
            )
          }
        }),
      )
    }

    for (const wi of workItems) {
      const linkedPrRefs = prRefsByWorkItem[wi.id] || []
      for (const ref of linkedPrRefs) {
        const pr = prDetails[ref.key]
        if (!pr) continue

        const status = mapPrStatus(pr)
        const prObj = {
          id: `PR-${pr.pullRequestId}`,
          title: pr.title,
          url: pr._links?.web?.href || `https://dev.azure.com/${encodeURIComponent(ADO_ORG)}/${encodeURIComponent(ref.projectId)}/_git/${encodeURIComponent(ref.repoId)}/pullrequest/${pr.pullRequestId}`,
          status,
          sourceBranch: (pr.sourceRefName || '').replace('refs/heads/', ''),
          targetBranch: (pr.targetRefName || '').replace('refs/heads/', ''),
        }
        wi.pullRequests.push(prObj)

        const sessions = extractSessions(pr)
        for (const s of sessions) {
          const idx = wi.sessions.findIndex((existing) => existing.id === s.id)
          if (idx === -1) {
            wi.sessions.push(s)
          }
        }
      }
      wi.pullRequests.sort(
        (a, b) => Number(b.id.replace('PR-', '')) - Number(a.id.replace('PR-', '')),
      )
    }

    cache = workItems
    cacheAt = Date.now()
    res.json(workItems)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${port}`)
})
