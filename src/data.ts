import type { WorkItem } from './types'

export const mockWorkItems: WorkItem[] = [
  {
    id: 1234,
    title: 'Add single sign-on to customer portal',
    state: 'Active',
    url: 'https://dev.azure.com/org/project/_workitems/edit/1234',
    sessions: [
      {
        id: 'devin-cloud-ask-001',
        kind: 'cloud',
        url: 'https://app.devin.ai/sessions/devin-cloud-ask-001',
        startedAt: '2026-09-15T09:00:00Z',
        status: 'closed',
      },
      {
        id: 'devin-local-edit-042',
        kind: 'cloud',
        url: '#',
        startedAt: '2026-09-16T11:30:00Z',
        status: 'active',
      },
    ],
    pullRequests: [
      {
        id: 'PR-101',
        title: 'feat: add SSO login flow',
        url: 'https://dev.azure.com/org/project/_git/repo/pullrequest/101',
        status: 'open',
        sourceBranch: 'feature/1234-sso',
        targetBranch: 'main',
      },
    ],
  },
  {
    id: 1235,
    title: 'Fix payment gateway timeout',
    state: 'Resolved',
    url: 'https://dev.azure.com/org/project/_workitems/edit/1235',
    sessions: [
      {
        id: 'devin-cloud-ask-003',
        kind: 'cloud',
        url: 'https://app.devin.ai/sessions/devin-cloud-ask-003',
        startedAt: '2026-09-14T08:15:00Z',
        status: 'closed',
      },
    ],
    pullRequests: [
      {
        id: 'PR-97',
        title: 'fix: increase payment timeout and add retry',
        url: 'https://dev.azure.com/org/project/_git/repo/pullrequest/97',
        status: 'merged',
        sourceBranch: 'bugfix/1235-payment-timeout',
        targetBranch: 'main',
      },
    ],
  },
  {
    id: 1236,
    title: 'Update dashboard navigation',
    state: 'New',
    url: 'https://dev.azure.com/org/project/_workitems/edit/1236',
    sessions: [
      {
        id: 'devin-local-ask-007',
        kind: 'cloud',
        url: '#',
        startedAt: '2026-09-17T10:00:00Z',
        status: 'active',
      },
    ],
    pullRequests: [],
  },
]
