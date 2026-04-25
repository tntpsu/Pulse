// Lightweight in-memory diagnostics ring — captures the last few fetch
// failures so the Troubleshoot card can surface them on-glasses without
// needing a connected debugger or browser console. Bounded to keep memory
// flat; oldest entries drop off when the cap is hit.

export interface FetchFailure {
  url: string
  message: string
  status?: number
  at: number
}

const MAX = 8
const ring: FetchFailure[] = []

export function recordFetchFailure(url: string, err: unknown, status?: number): void {
  let message: string
  if (err instanceof Error) message = err.name === 'Error' ? err.message : `${err.name}: ${err.message}`
  else message = String(err)
  ring.unshift({ url, message: message.slice(0, 120), status, at: Date.now() })
  if (ring.length > MAX) ring.pop()
}

export function recentFailures(): FetchFailure[] {
  return ring.slice()
}

export function shortHost(url: string): string {
  if (!url) return '(unset)'
  return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 28)
}
