import { loadDuckOps } from '../api'
import type { DuckOpsStatus } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

// Defensive client-side filter for the trend-ideas surface. The upstream
// pipeline (business_operator_desk.py) sometimes surfaces noisy or legally
// risky candidates (e.g. "donald duck" — protected Disney IP, "wildcats duck"
// — too generic to act on). Filtering here is the lowest-friction
// improvement; deeper fixes belong in the source pipeline.
//
// MIN_SCORE: trend score is roughly proportional to competitor signal
// strength. Anything below this is unlikely to justify a build cycle.
const MIN_SCORE = 1500

// Keyword denylist — match as a whole-word substring against the lowercased
// title. Anything that smells like protected IP gets skipped before it
// reaches the glasses. Add to this list as new false-positives surface;
// the score on each item shows which idea was filtered, so you can audit
// what got through with the score column on the detail face.
const IP_DENYLIST = [
  // Disney / Pixar
  'disney', 'mickey', 'minnie', 'donald duck', 'daisy duck', 'goofy',
  'pixar', 'frozen', 'elsa', 'anna ', 'olaf', 'moana', 'simba',
  // Marvel / DC
  'marvel', 'spider-man', 'spiderman', 'iron man', 'thor', 'hulk',
  'batman', 'superman', 'wonder woman', 'joker',
  // Game / anime franchises commonly trademarked
  'pokemon', 'pokémon', 'pikachu', 'mario', 'luigi', 'zelda', 'minecraft',
  'fortnite', 'naruto', 'goku', 'sonic the hedgehog',
  // Sports leagues with protected marks (use generic mascots/colors instead)
  'nfl ', 'nba ', 'nhl ', 'mlb ',
]

interface RankedIdea {
  title: string
  score: number
  status?: string
}

function isIpRisk(title: string): boolean {
  const t = title.toLowerCase()
  return IP_DENYLIST.some(kw => t.includes(kw))
}

function filteredIdeas(data: DuckOpsStatus): RankedIdea[] {
  return data.trendIdeas
    .filter(t => t.score >= MIN_SCORE && !isIpRisk(t.title))
    .slice(0, 8)
}

function format(data: unknown, error: string | null): string {
  const title = 'NEW TREND IDEAS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const ideas = filteredIdeas(data as DuckOpsStatus)
  if (ideas.length === 0) {
    return [title, '', 'No actionable gaps right now', '(low-score + IP-risk filtered)'].join('\n')
  }
  const lines = ideas.slice(0, 4).map((t, i) => `${i + 1}. ${t.title}`)
  return [title, '', 'Not in catalog:', ...lines].join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const title = 'NEW TREND IDEAS'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const ideas = filteredIdeas(data as DuckOpsStatus)
  if (ideas.length === 0) {
    return [
      title,
      '',
      'Nothing actionable right now.',
      '',
      `Filter: score ≥ ${MIN_SCORE}, IP-risk excluded.`,
    ].join('\n')
  }
  const lines = ideas.map((t, i) => {
    const tag = t.status === 'partial' ? ' (partial)' : ' (new)'
    return `${i + 1}. ${t.title}${tag}\n   trend score: ${Math.round(t.score)}`
  })
  return [
    title,
    '',
    'Trends NOT yet covered:',
    '',
    ...lines,
  ].join('\n')
}

export const duckOpsTrendsCard: CardDefinition = {
  id: 'duckops-trends',
  title: 'Trends',
  pollMs: 1_800_000,
  load: () => loadDuckOps(),
  format,
  formatDetail,
}
