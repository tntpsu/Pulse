export interface DuckOpsPacking {
  etsy: number
  shopify: number
  uniqueTitles: number
  duckNames: string[]
  packItems?: Array<{ title: string; qty: number; shipBy?: string | null }>
}

export interface DuckOpsCustomBuild {
  name: string
  quantity: number
  dueLabel?: string
}

export interface DuckOpsShipmentSample {
  tracking: string
  buyer: string
  daysStuck: number
}

export interface DuckOpsShipmentsStuck {
  count: number
  samples: DuckOpsShipmentSample[]
  note?: string
}

export interface DuckOpsTrend {
  title: string
  score: number
  status?: string
}

export interface DuckOpsTask {
  id: string
  action: string
  type: string
  summary?: string
  customerName?: string | null
}

export interface DuckOpsWeeklyInsights {
  thisWeekOrders: number
  thisWeekUnits: number
  lastWeekOrders: number
  lastWeekUnits: number
  weekOverWeekPct: number | null
  bestSellerThisWeek: { title: string; units: number } | null
  topSellersThisWeek?: Array<{ title: string; units: number }>
  avgUnitsPerOrderToday: number
  todayOrders: number
  unsoldInWindow: {
    count: number
    windowDays: number
    sample: string[]
  }
}

export interface DuckOpsWeeklySales {
  etsyOrdersThisWeek: number
  etsyUnitsThisWeek: number
  shopifyOpenOrders: number
  shopifyOpenUnits: number
  etsyOrdersToday?: number
  etsyUnitsToday?: number
  shopifyOrdersToday?: number
  shopifyUnitsToday?: number
}

export interface DuckOpsPendingApproval {
  artifactId: string
  flow: string
  title: string
  targets: string[]
  publishToken?: string | null
  bodyPreview?: string
}

export interface DuckOpsSalesTrends {
  todayUnits: number
  todayOrders: number
  yesterdayUnits: number
  yesterdayOrders: number
  wtdUnits: number
  wtdOrders: number
  wtdLastWeekUnits: number
  wtdLastWeekOrders: number
  mtdUnits: number
  mtdOrders: number
  mtdLastMonthUnits: number
  mtdLastMonthOrders: number
  source: string
}

export interface DuckOpsStatus {
  generatedAt: string
  ducksToPackToday: number
  customersToReply: number
  postAgent: { draft: number; published: number; unknown: number }
  customBuilds: DuckOpsCustomBuild[]
  packing: DuckOpsPacking
  shipmentsStuck: DuckOpsShipmentsStuck
  trendIdeas: DuckOpsTrend[]
  topTasks: DuckOpsTask[]
  weeklyInsights: DuckOpsWeeklyInsights
  weeklySales: DuckOpsWeeklySales
  salesTrends?: DuckOpsSalesTrends
  pendingApprovals: DuckOpsPendingApproval[]
}

export interface WeatherSnapshot {
  temperatureF: number
  conditionLabel: string
}

export interface SportsGameSnapshot {
  state: 'pre' | 'in' | 'post' | 'none'
  opponentAbbrev: string | null
  homeAway: 'home' | 'away' | null
  scoreSelf: number | null
  scoreOpponent: number | null
  period: string | null
  clock: string | null
  startsAtLabel: string | null
  resultLabel: string | null
}

export interface CalendarEvent {
  startLabel: string
  title: string
}

export interface CalendarSnapshot {
  events: CalendarEvent[]
  status: 'ok' | 'mock' | 'unconfigured'
}

export interface MessageItem {
  from: string
  preview: string
  handle?: string
}

export interface MessageSummary {
  unreadCount: number
  lastSenders: string[]
  items?: MessageItem[]
  status: 'ok' | 'mock' | 'unconfigured'
  note?: string
}

export interface GithubPr {
  repo: string
  number: number
  title: string
  author: string
}

export interface GithubPrsSnapshot {
  status: 'ok' | 'unconfigured' | 'error'
  prs: GithubPr[]
  reviewer?: string
  note?: string
}

export interface GithubCiRepo {
  repo: string
  conclusion: string
  workflow?: string
  branch?: string
  note?: string
}

export interface GithubCiSnapshot {
  status: 'ok' | 'unconfigured' | 'error'
  repos: GithubCiRepo[]
  note?: string
}

export interface TaskItem {
  id: string
  title: string
  dueLabel: string
  // "Added" proxy derived from Google Tasks' `updated` field (the public API
  // doesn't expose `created`). For unmodified tasks this equals add time.
  updatedLabel?: string
}

export interface TaskList {
  title: string
  id: string
  tasks: TaskItem[]
}

export interface TasksSnapshot {
  status: 'ok' | 'unconfigured' | 'error'
  lists: TaskList[]
  note?: string
}

// Flattened task record used by the item-paginated Tasks card.
export interface FlatTask {
  listTitle: string
  listId: string
  taskId: string
  title: string
  dueLabel: string
  updatedLabel?: string
}

export interface GmailUnreadItem {
  from: string
  subject: string
}

export interface GmailUnreadSnapshot {
  status: 'ok' | 'unconfigured' | 'error'
  unreadCount: number
  items: GmailUnreadItem[]
  note?: string
}

export interface NowPlayingSnapshot {
  status: 'ok'
  playing: boolean
  track?: string
  artist?: string
  source?: string
}
