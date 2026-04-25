import {
  loadEspnTeamNewsList,
  loadEspnTeamSchedule,
  type EspnArticle,
  type EspnScheduleSummary,
  type EspnTeamConfig,
} from '../api'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition, PickerOption } from './_types'

interface TeamConfig {
  displayName: string
  short: string
  cfg: EspnTeamConfig
}

interface TeamSnapshot {
  displayName: string
  short: string
  schedule: EspnScheduleSummary
  articles: EspnArticle[]
}

interface SportsSnapshot {
  teams: TeamSnapshot[]
}

const TEAMS: TeamConfig[] = [
  { displayName: 'Penguins',   short: 'PEN', cfg: { league: 'hockey/nhl',              team: 'PIT', sport: 'hockey',   teamId: 16  } },
  { displayName: 'Pirates',    short: 'PIR', cfg: { league: 'baseball/mlb',             team: 'PIT', sport: 'baseball', teamId: 23  } },
  { displayName: 'Steelers',   short: 'STE', cfg: { league: 'football/nfl',             team: 'PIT', sport: 'football', teamId: 23  } },
  { displayName: 'Penn State', short: 'PSU', cfg: { league: 'football/college-football', team: 'PSU', sport: 'football', teamId: 213 } },
]

const EMPTY_SCHEDULE: EspnScheduleSummary = { last: null, next: null }

async function loadOneTeam(t: TeamConfig): Promise<TeamSnapshot> {
  const [schedule, articles] = await Promise.all([
    loadEspnTeamSchedule(t.cfg).catch(() => EMPTY_SCHEDULE),
    loadEspnTeamNewsList(t.cfg, 3).catch(() => [] as EspnArticle[]),
  ])
  return { displayName: t.displayName, short: t.short, schedule, articles }
}

async function loadSports(): Promise<SportsSnapshot> {
  const teams = await Promise.all(TEAMS.map(loadOneTeam))
  return { teams }
}

function lastLine(t: TeamSnapshot): string {
  const l = t.schedule.last
  if (!l) return `${t.short}  prev: —`
  const opp = l.opponentAbbrev ?? '???'
  const vs = l.homeAway === 'home' ? `vs ${opp}` : `@ ${opp}`
  if (l.scoreSelf !== null && l.scoreOpponent !== null) {
    return `${t.short}  ${vs} ${l.scoreSelf}-${l.scoreOpponent}`
  }
  return `${t.short}  ${vs} F`
}

function nextLine(t: TeamSnapshot): string {
  const n = t.schedule.next
  if (!n) return `      next: —`
  const opp = n.opponentAbbrev ?? '???'
  const vs = n.homeAway === 'home' ? `vs ${opp}` : `@ ${opp}`
  return `      next ${vs} ${n.startsAtLabel ?? 'TBD'}`
}

function format(data: unknown, error: string | null): string {
  const title = 'SPORTS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as SportsSnapshot
  const lines: string[] = [title, '']
  for (const team of snap.teams) {
    lines.push(lastLine(team))
    lines.push(nextLine(team))
  }
  return lines.join('\n')
}

function formatItem(item: unknown, index: number, total: number): string {
  const t = item as TeamSnapshot
  // Densified to fit the 336x288 right column without scrolling: each game
  // collapses to one line, no blank lines between sections, no headline
  // preview (the picker shows headlines anyway).
  const lines: string[] = [`${t.displayName.toUpperCase()} ${index + 1}/${total}`]
  const l = t.schedule.last
  if (l) {
    const opp = l.opponentAbbrev ?? '???'
    const vs = l.homeAway === 'home' ? `vs ${opp}` : `@ ${opp}`
    const score =
      l.scoreSelf !== null && l.scoreOpponent !== null
        ? ` ${l.scoreSelf}-${l.scoreOpponent}`
        : ''
    const result = l.resultLabel ? ` ${l.resultLabel.slice(0, 6)}` : ''
    const date = l.dateLabel ? ` ${l.dateLabel}` : ''
    lines.push(`Last:${date} ${vs}${score}${result}`)
  } else {
    lines.push('Last: —')
  }
  const n = t.schedule.next
  if (n) {
    const opp = n.opponentAbbrev ?? '???'
    const vs = n.homeAway === 'home' ? `vs ${opp}` : `@ ${opp}`
    const when = n.startsAtLabel ? ` ${n.startsAtLabel}` : ''
    lines.push(`Next: ${vs}${when}`)
  } else {
    lines.push('Next: —')
  }
  if (t.articles.length > 0) {
    lines.push('', `${t.articles.length} ESPN articles`)
  }
  return lines.join('\n')
}

function teamArticleActions(item: unknown): PickerOption[] {
  const t = item as TeamSnapshot
  if (t.articles.length === 0) return []
  // Cap at 3 so the [tap] hint block in detail view doesn't overflow the
  // right column; loadOneTeam also fetches only 3 for the same reason.
  return t.articles.slice(0, 3).map((article, i) => ({
    // Short-title the headline so the picker list fits; full text goes in run().
    label: `${i + 1}. ${article.headline.slice(0, 48)}`,
    run: async () => {
      const body = article.description?.trim() || '(no summary available)'
      const published = article.published ? `\n— ${article.published.slice(0, 10)}` : ''
      // ESPN's `news` endpoint only ships short summaries; full article body
      // lives at the URL below. Show it so the user can finish reading on
      // their phone.
      const linkLine = article.url ? `\n\nfull: ${article.url}` : ''
      return {
        ok: true,
        message: `${article.headline}\n\n(summary)\n${body}${published}${linkLine}`,
      }
    },
  }))
}

export const sportsCard: CardDefinition = {
  id: 'sports',
  title: 'Sports',
  pollMs: 60_000,
  load: loadSports,
  format,
  getItems: data => (data as SportsSnapshot).teams,
  formatItem,
  // Each team's picker lists its recent articles; selecting one shows the
  // full article body as a (dismissable) transient.
  getActions: teamArticleActions,
}
