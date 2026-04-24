import { loadNowPlaying } from '../api'
import type { NowPlayingSnapshot } from '../types'
import { formatError, formatLoading } from './_shared'
import type { CardDefinition } from './_types'

function format(data: unknown, error: string | null): string {
  const title = 'NOW PLAYING'
  if (error) return formatError(title, error)
  if (!data) return formatLoading(title)
  const snap = data as NowPlayingSnapshot
  if (!snap.playing) return [title, '', 'Nothing playing'].join('\n')
  const source = snap.source ? ` (${snap.source})` : ''
  return [title + source, '', snap.track ?? '(unknown track)', snap.artist ?? ''].join('\n')
}

export const nowPlayingCard: CardDefinition = {
  id: 'now-playing',
  title: 'Now Playing',
  pollMs: 15_000,
  load: () => loadNowPlaying(),
  format,
}
