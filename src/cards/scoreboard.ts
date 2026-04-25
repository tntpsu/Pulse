import { loadEspnLeagueScoreboard, type LeagueGame, type LeagueScoreboard } from '../api'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

// Pick a sport, see today's games. Different from the per-team `sports` card
// which tracks specific Pittsburgh teams — this one is league-wide live scores.
//
// The card is item-paginated: each league is one item, swipe to switch
// leagues in detail view. The summary face (dashboard) shows an aggregate
// "X live across Y leagues" line plus a per-league live-game count.

interface LeagueSpec {
  league: string // ESPN path segment
  displayName: string // human label
}

// Default league set — covers the major US pro + college leagues. Order is
// the swipe order in detail view; pick by perceived day-of-week activity.
const LEAGUES: LeagueSpec[] = [
  { league: 'basketball/nba', displayName: 'NBA' },
  { league: 'football/nfl', displayName: 'NFL' },
  { league: 'hockey/nhl', displayName: 'NHL' },
  { league: 'baseball/mlb', displayName: 'MLB' },
  { league: 'football/college-football', displayName: 'NCAAF' },
  { league: 'basketball/mens-college-basketball', displayName: 'NCAAB' },
]

const POLL_MS = 60_000 // 1 min — live scores need to feel current
const MAX_GAMES_PER_LEAGUE = 8 // protect against the 288-px height limit on big slates

const EMPTY_SCOREBOARD: Omit<LeagueScoreboard, 'displayName' | 'league'> = { games: [] }

async function loadScoreboards(): Promise<LeagueScoreboard[]> {
  const results = await Promise.all(
    LEAGUES.map(spec =>
      loadEspnLeagueScoreboard(spec.league, spec.displayName).catch(
        (): LeagueScoreboard => ({ ...EMPTY_SCOREBOARD, ...spec }),
      ),
    ),
  )
  return results
}

function liveCount(s: LeagueScoreboard): number {
  return s.games.filter(g => g.state === 'in').length
}

function gameLine(g: LeagueGame): string {
  // "DET @ MIN  102-98  Q4 2:30" — single line per game. Score column omitted
  // for pre-game so the start time has room.
  const matchup = `${g.awayAbbrev} @ ${g.homeAbbrev}`
  if (g.state === 'pre') {
    return `${matchup}  ${g.statusLabel}`
  }
  const score =
    g.awayScore !== null && g.homeScore !== null
      ? `${g.awayScore}-${g.homeScore}`
      : '—'
  return `${matchup}  ${score}  ${g.statusLabel}`
}

function format(data: unknown, error: string | null): string {
  const title = 'SCOREBOARD'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const all = data as LeagueScoreboard[]
  const liveTotal = all.reduce((acc, s) => acc + liveCount(s), 0)
  const lines: string[] = [
    title,
    '',
    liveTotal > 0
      ? `${liveTotal} live across ${LEAGUES.length} leagues`
      : 'No live games right now',
    '',
  ]
  for (const s of all) {
    const live = liveCount(s)
    const total = s.games.length
    if (live > 0) {
      lines.push(`${s.displayName.padEnd(6, ' ')} ${live} live  (${total} today)`)
    } else if (total > 0) {
      lines.push(`${s.displayName.padEnd(6, ' ')} ${total} today`)
    } else {
      lines.push(`${s.displayName.padEnd(6, ' ')} —`)
    }
  }
  lines.push('')
  lines.push('[tap] pick league')
  return lines.join('\n')
}

function formatItem(item: unknown, index: number, total: number): string {
  const s = item as LeagueScoreboard
  const live = liveCount(s)
  const lines: string[] = [`${s.displayName} ${index + 1}/${total}`]
  if (s.games.length === 0) {
    lines.push('', 'No games today.')
  } else {
    lines.push('')
    if (live > 0) lines.push(`${live} live · ${s.games.length} total`)
    else lines.push(`${s.games.length} games today`)
    lines.push('')
    for (const g of s.games.slice(0, MAX_GAMES_PER_LEAGUE)) {
      lines.push(gameLine(g))
    }
    if (s.games.length > MAX_GAMES_PER_LEAGUE) {
      lines.push(`(+${s.games.length - MAX_GAMES_PER_LEAGUE} more)`)
    }
  }
  return lines.join('\n')
}

export const scoreboardCard: CardDefinition = {
  id: 'scoreboard',
  title: 'Scoreboard',
  pollMs: POLL_MS,
  load: loadScoreboards,
  format,
  getItems: data => data as LeagueScoreboard[],
  formatItem,
}
