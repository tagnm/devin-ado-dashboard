export interface MetricThresholds {
  greenMax: number
  amberMax: number
}

export interface DashboardConfig {
  metrics: {
    workItems: MetricThresholds
    activeItems: MetricThresholds
    openPullRequests: MetricThresholds
  }
}

export const defaultDashboardConfig: DashboardConfig = {
  metrics: {
    workItems: { greenMax: 20, amberMax: 30 },
    activeItems: { greenMax: 10, amberMax: 15 },
    openPullRequests: { greenMax: 3, amberMax: 7 },
  },
}

export async function fetchDashboardConfig(): Promise<DashboardConfig> {
  try {
    const response = await fetch('/api/dashboard-config')
    if (!response.ok) return defaultDashboardConfig
    return await response.json() as DashboardConfig
  } catch {
    return defaultDashboardConfig
  }
}
