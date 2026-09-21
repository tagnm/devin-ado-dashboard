# Devin Dashboard

A dense, operations-style dashboard that correlates Azure DevOps work items, linked pull requests, and Devin sessions — using the ADO work item ID as the common identifier.

## Stack

- **Frontend:** React + TypeScript + Vite, Lucide icons
- **Backend:** Node.js + Express (serves the built app and proxies ADO REST calls)
- **Container:** Podman/Docker Compose (Node 22 Alpine)

## How it works

- The backend runs a WIQL query for open work items assigned to `@Me`, filtered by `ADO_WIQL_FILTER` (area path + work item type).
- Linked `PullRequestId` relations are resolved per work item, scoped to the configured repository.
- Devin session links (`https://app.devin.ai/sessions/<uuid>`) are extracted from PR descriptions — a session only appears if its link is present in a linked PR.
- Results are cached in memory for 5 minutes.

## Important caveats

- **Development mode only.** The Compose stack runs Vite in dev mode (HMR) plus a Node `--watch` backend. It is not a hardened production deployment — there is no auth, no TLS, and secrets live in a local `.env` file.
- **Mock fallback.** If the backend is unreachable or returns an error, the frontend silently falls back to fake sample data (`src/data.ts`). If the data looks wrong, check the backend container logs first.
- **`.env` changes require container recreation.** `env_file` values are injected at container creation; `podman compose down; podman compose up -d` is needed — `podman restart` is not enough.

## Prerequisites

- Podman Desktop (or Docker) with Compose support, **or** Node.js 22+ if running outside containers
- An Azure DevOps PAT with **Work Items (Read)** and **Code (Read)** scopes

## Setup

```powershell
git clone <repo-url>
cd devin-ado-dashboard
Copy-Item .env.example .env
Copy-Item dashboard.config.example.json dashboard.config.json
```

```ini
ADO_ORG=your-ado-organisation
ADO_PROJECT=your-ado-project
ADO_REPO_NAME=your-repo-name
ADO_PAT=<your Azure DevOps PAT>
ADO_WIQL_FILTER=AND [System.AreaPath] UNDER 'Your Project\Your Area' AND [System.WorkItemType] = 'User Story'
PORT=3000
ADO_API_VERSION=7.1
```

Edit `.env` with your ADO values. Metric traffic-light thresholds can be customized in the local `dashboard.config.json`:

```json
{
  "metrics": {
    "workItems": { "greenMax": 20, "amberMax": 30 },
    "activeItems": { "greenMax": 10, "amberMax": 15 },
    "openPullRequests": { "greenMax": 3, "amberMax": 7 }
  }
}
```

Values up to `greenMax` are green, values up to `amberMax` are amber, and higher values are red. Invalid or missing entries fall back to the defaults in `dashboard.config.example.json`. The Sessions metric remains neutral. `dashboard.config.json` is git-ignored so each engineer can keep personal thresholds.

Then:

```powershell
podman compose up -d --build
```

Open http://localhost:3000

## Development

The Compose setup runs a Vite dev server with HMR on port 3000 and a Node watch-mode backend on 3001 (proxied at `/api`). Source edits apply without rebuilding.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — TypeScript + production build
- `npm start` — Express backend (serves `dist/` and `/api`)
- `npm run lint` — Oxlint

## Testing

No unit tests exist yet — contributions welcome. Vitest is the intended framework (it integrates natively with Vite). Good first candidates: `extractSessions` URL parsing, PR status mapping, and the search filter in `adoService.ts`.

