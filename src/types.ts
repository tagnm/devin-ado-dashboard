export type SessionKind = 'cloud'
export type SessionStatus = 'active' | 'closed' | 'archived'

export interface DevinSession {
  id: string
  kind: SessionKind
  url: string
  startedAt: string
  status: SessionStatus
}

export type PrStatus = 'open' | 'merged' | 'abandoned' | 'draft'

export interface PullRequest {
  id: string
  title: string
  url: string
  status: PrStatus
  sourceBranch: string
  targetBranch: string
  updatedAt: string | null
}

export type WorkItemState = 'New' | 'Active' | 'Resolved' | 'Closed'
export type WorkItemType = 'User Story' | 'Bug' | string

export interface WorkItem {
  id: number
  title: string
  state: WorkItemState
  type: WorkItemType
  url: string
  sessions: DevinSession[]
  pullRequests: PullRequest[]
}
