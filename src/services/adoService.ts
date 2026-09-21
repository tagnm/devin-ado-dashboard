import type { WorkItem } from '../types'
import { mockWorkItems } from '../data'

export async function fetchWorkItems(query?: string): Promise<WorkItem[]> {
  // The dashboard now gets live data from the Node backend.
  // If the backend is unreachable, it falls back to the mock dataset.
  try {
    const res = await fetch('/api/workitems')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const items: WorkItem[] = await res.json()

    if (!query) return items

    const q = query.trim().toLowerCase()
    return items.filter(
      (w) =>
        w.id.toString().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.sessions.some((s) => s.id.toLowerCase().includes(q)) ||
        w.pullRequests.some(
          (p) =>
            p.id.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q),
        ),
    )
  } catch {
    if (!query) return mockWorkItems

    const q = query.trim().toLowerCase()
    return mockWorkItems.filter(
      (w) =>
        w.id.toString().includes(q) ||
        w.title.toLowerCase().includes(q) ||
        w.sessions.some((s) => s.id.toLowerCase().includes(q)) ||
        w.pullRequests.some(
          (p) =>
            p.id.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q),
        ),
    )
  }
}
