import { loadWeatherForecast } from '../api'
import type { DailyWeather, WeatherForecast } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

const POLL_MS = 30 * 60_000 // refresh every 30 min — open-meteo updates hourly

// Optional human-readable city label. Lat/lon drive the actual forecast call;
// this string just labels which place those coords are. Useful when the user
// changes lat/lon for travel — the header reminds them which city is active.
const CITY = import.meta.env.VITE_WEATHER_CITY?.trim() ?? ''

// Compact 3-letter day-of-week so the line fits the right column.
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dowLabel(dateStr: string, idx: number): string {
  if (idx === 0) return 'Today'
  // open-meteo returns dates as YYYY-MM-DD; parse as local midnight.
  const [y, m, d] = dateStr.split('-').map(n => Number(n))
  if (!y || !m || !d) return '???'
  const dt = new Date(y, m - 1, d)
  return DOW[dt.getDay()] ?? '???'
}

// Shorten condition labels to fit the line. "Heavy thunderstorm" → "Storm".
function shortCond(label: string): string {
  if (label.startsWith('Thunder')) return 'Storm'
  if (label.startsWith('Heavy ')) return label.slice(6, 14)
  if (label === 'Mostly clear') return 'M.Clear'
  if (label === 'Partly cloudy') return 'P.Cloud'
  if (label === 'Snow showers') return 'Snow sh'
  return label.slice(0, 9)
}

function formatDayLine(d: DailyWeather, i: number): string {
  // "Today  68/45  Sun" — pad day name and hi/lo column for alignment.
  const day = dowLabel(d.date, i).padEnd(5, ' ')
  const hilo = `${d.hi}/${d.lo}`.padEnd(6, ' ')
  return `${day} ${hilo} ${shortCond(d.conditionLabel)}`
}

// The env city label only describes the env coordinates; a device fix
// may be anywhere, so it gets a generic header instead of a wrong city.
function titleFor(f: WeatherForecast | null, suffix = ''): string {
  if (f?.source === 'device') return `WEATHER HERE${suffix}`
  return (CITY ? CITY.toUpperCase() : 'WEATHER') + suffix
}

function format(data: unknown, error: string | null): string {
  const f = (data as WeatherForecast | undefined) ?? null
  const title = titleFor(f)
  if (error) return formatError(title, error)
  if (!f) return formatLoading(title)
  const lines: string[] = [
    title,
    `${f.current.temperatureF}F  ${f.current.conditionLabel}`,
    '',
    '5-day:',
  ]
  for (let i = 0; i < f.days.length; i += 1) {
    lines.push(formatDayLine(f.days[i]!, i))
  }
  return lines.join('\n')
}

function formatDetail(data: unknown, error: string | null): string {
  const f = (data as WeatherForecast | undefined) ?? null
  const title = f?.source === 'device' ? 'FORECAST HERE' : titleFor(null, ' — FORECAST')
  if (error) return formatError(title, error)
  if (!f) return formatLoading(title)
  const lines: string[] = [
    title,
    '',
    `Now:  ${f.current.temperatureF}F  ${f.current.conditionLabel}`,
    '',
    'Daily highs / lows:',
  ]
  for (let i = 0; i < f.days.length; i += 1) {
    lines.push(`  ${formatDayLine(f.days[i]!, i)}`)
  }
  return lines.join('\n')
}

export const weatherCard: CardDefinition = {
  id: 'weather',
  title: 'Weather',
  pollMs: POLL_MS,
  load: loadWeatherForecast,
  format,
  formatDetail,
}
