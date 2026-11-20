import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Ban,
  BookOpen,
  Bug,
  Check,
  Circle,
  CircleCheck,
  CircleDot,
  ClipboardList,
  Cloud,
  CloudOff,
  ExternalLink,
  FileEdit,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Inbox,
  LoaderCircle,
  PlugZap,
  Search,
  Ticket,
} from 'lucide-react'
import type { DevinSession, PullRequest, WorkItem } from './types'
import { fetchWorkItems } from './services/adoService'
import {
  defaultDashboardConfig,
  fetchDashboardConfig,
  type MetricThresholds,
} from './services/dashboardConfig'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<WorkItem[]>([])
  const [config, setConfig] = useState(defaultDashboardConfig)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchWorkItems(query), fetchDashboardConfig()]).then(([data, dashboardConfig]) => {
      if (!cancelled) {
        setItems(data)
        setConfig(dashboardConfig)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [query])

  const totals = useMemo(
    () => ({
      workItems: items.length,
      active: items.filter((item) => item.state === 'Active').length,
      sessions: items.reduce((total, item) => total + item.sessions.length, 0),
      openPrs: items.reduce(
        (total, item) =>
          total + item.pullRequests.filter((pr) => pr.status === 'open' || pr.status === 'draft').length,
        0,
      ),
    }),
    [items],
  )

  return (
    <main className="dashboard">
      <header className="app-header">
        <div>
          <span className="eyebrow">
            <Activity size={14} aria-hidden="true" />
            Engineering operations
          </span>
          <h1>Devin ADO Dashboard</h1>
        </div>
        <div className="system-state" role="status">
          <PlugZap size={14} aria-hidden="true" />
          ADO connected
        </div>
      </header>

      <section className="summary-strip" aria-label="Dashboard summary">
        <Metric label="Work items" value={totals.workItems} thresholds={config.metrics.workItems} icon={<ClipboardList size={18} aria-hidden="true" />} />
        <Metric label="Active items" value={totals.active} thresholds={config.metrics.activeItems} icon={<Activity size={18} aria-hidden="true" />} />
        <Metric label="Sessions" value={totals.sessions} icon={<Cloud size={18} aria-hidden="true" />} />
        <Metric label="Open PRs" value={totals.openPrs} thresholds={config.metrics.openPullRequests} icon={<GitPullRequest size={18} aria-hidden="true" />} />
      </section>

      <section className="workspace" aria-labelledby="workspace-title">
        <div className="toolbar">
          <div>
            <h2 id="workspace-title">ADO work items</h2>
            <span className="result-count">{loading ? 'Loading records' : `${items.length} records`}</span>
          </div>
          <label className="search-field">
            <span className="visually-hidden">Search work items</span>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Filter ID, title, session or PR"
              value={query}
              onChange={(event) => {
                setLoading(true)
                setQuery(event.target.value)
              }}
            />
          </label>
        </div>

        <div className="table-frame" aria-busy={loading}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" className="id-column"><TableHead icon={<Ticket size={14} />} label="Work item" /></th>
                <th scope="col">Title</th>
                <th scope="col" className="state-column">State</th>
                <th scope="col"><TableHead icon={<Cloud size={14} />} label="Devin sessions" /></th>
                <th scope="col"><TableHead icon={<GitPullRequest size={14} />} label="Pull requests" /></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="table-message">
                    <LoaderCircle className="spin" size={24} aria-hidden="true" />
                    Loading work items…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-message">
                    <Inbox size={24} aria-hidden="true" />
                    No records match the current filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => <WorkItemRow key={item.id} item={item} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function TableHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="table-head">
      {icon}
      {label}
    </span>
  )
}

type TrafficState = 'green' | 'amber' | 'red' | 'neutral'

function Metric({
  label,
  value,
  thresholds,
  icon,
  href,
}: {
  label: string
  value: number
  thresholds?: MetricThresholds
  icon: React.ReactNode
  href?: string
}) {
  const trafficState: TrafficState = !thresholds
    ? 'neutral'
    : value <= thresholds.greenMax
      ? 'green'
      : value <= thresholds.amberMax
        ? 'amber'
        : 'red'

  const body = (
    <>
      <span className="metric-label">{icon}{label}</span>
      <strong>{value}</strong>
      <span className="metric-state">{trafficState}</span>
    </>
  )
  const className = `metric metric-${trafficState}${href ? ' metric-linked' : ''}`
  return href ? (
    <a className={className} href={href}>{body}</a>
  ) : (
    <div className={className}>{body}</div>
  )
}

function WorkItemTypeIcon({ type }: { type: WorkItem['type'] }) {
  const isBug = type === 'Bug'
  const Icon = isBug ? Bug : BookOpen
  const label = type || 'Work item'
  return (
    <span
      className={`wi-type-icon ${isBug ? 'wi-type-bug' : 'wi-type-story'}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon size={14} aria-hidden="true" />
    </span>
  )
}

function WorkItemRow({ item }: { item: WorkItem }) {
  return (
    <tr>
      <td className="id-cell">
        <WorkItemTypeIcon type={item.type} />
        <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open work item ${item.id}`}>
          {item.id}
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </td>
      <td className="title-cell">{item.title}</td>
      <td><StatusTag value={item.state} /></td>
      <td><SessionList sessions={item.sessions} /></td>
      <td><PullRequestList pullRequests={item.pullRequests} /></td>
    </tr>
  )
}

function SessionList({ sessions }: { sessions: DevinSession[] }) {
  if (sessions.length === 0) {
    return (
      <span className="empty-value">
        <CloudOff size={16} aria-hidden="true" />
        No sessions
      </span>
    )
  }

  return (
    <ul className="entity-list">
      {sessions.map((session) => (
        <li key={session.id}>
          <span className="source-mark source-cloud" title="Cloud session">
            <Cloud size={14} aria-hidden="true" />
          </span>
          <a href={session.url} target="_blank" rel="noreferrer">{session.id}</a>
        </li>
      ))}
    </ul>
  )
}

function PullRequestList({ pullRequests }: { pullRequests: PullRequest[] }) {
  if (pullRequests.length === 0) {
    return (
      <span className="empty-value">
        <GitPullRequestClosed size={16} aria-hidden="true" />
        No pull requests
      </span>
    )
  }

  return (
    <ul className="entity-list pr-entities">
      {pullRequests.map((pr) => (
        <li key={pr.id}>
          <StatusTag value={pr.status} compact />
          <a href={pr.url} target="_blank" rel="noreferrer" title={pr.title}>{pr.id}</a>
          <span className="secondary-value branch" title={`${pr.sourceBranch} → ${pr.targetBranch}`}>
            {pr.sourceBranch}
          </span>
        </li>
      ))}
    </ul>
  )
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  active: <CircleDot size={12} />,
  new: <Circle size={12} />,
  resolved: <CircleCheck size={12} />,
  closed: <Check size={12} />,
  open: <GitPullRequest size={12} />,
  merged: <GitMerge size={12} />,
  abandoned: <Ban size={12} />,
  draft: <FileEdit size={12} />,
}

function StatusTag({ value, compact = false }: { value: string; compact?: boolean }) {
  const icon = STATUS_ICONS[value.toLowerCase()] || <Circle size={12} />
  return (
    <span className={`status-tag status-${value.toLowerCase()} ${compact ? 'status-compact' : ''}`}>
      {icon}
      {value}
    </span>
  )
}

export default App
