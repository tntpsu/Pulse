// Weather coordinates. The glasses bridge supplies the phone's location
// (SDK 0.0.16 getAppLocation, behind the `location` permission); the
// VITE_WEATHER_LAT / LON env pair is the fallback for the dev preview and
// for a host that returns nothing.

export interface Coords {
  lat: string
  lon: string
}

export type CoordsSource = 'device' | 'default'

export interface ResolvedCoords {
  coords: Coords
  source: CoordsSource
}

export interface DeviceLocation {
  latitude: number
  longitude: number
}

export type LocationProvider = () => Promise<DeviceLocation | null>

export const DEFAULT_COORDS: Coords = {
  lat: import.meta.env.VITE_WEATHER_LAT?.trim() ?? '40.4406',
  lon: import.meta.env.VITE_WEATHER_LON?.trim() ?? '-79.9959',
}

// A device fix is reused for this long so the weather poll does not wake
// the phone's GPS every 30 minutes for a reading that rarely changes.
export const LOCATION_TTL_MS = 30 * 60_000

let provider: LocationProvider | null = null
let cached: ResolvedCoords | null = null
let cachedAt = 0

export function setLocationProvider(p: LocationProvider | null): void {
  provider = p
  cached = null
  cachedAt = 0
}

// Four decimals (~11 m) keeps the open-meteo URL stable across GPS jitter,
// so the per-URL stale-data cache in api.ts keeps hitting.
export function toCoords(loc: DeviceLocation): Coords | null {
  const { latitude, longitude } = loc
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  if (latitude === 0 && longitude === 0) return null
  return { lat: latitude.toFixed(4), lon: longitude.toFixed(4) }
}

export async function resolveCoords(now: number = Date.now()): Promise<ResolvedCoords> {
  if (cached && now - cachedAt < LOCATION_TTL_MS) return cached
  let next: ResolvedCoords = { coords: DEFAULT_COORDS, source: 'default' }
  if (provider) {
    try {
      const loc = await provider()
      const coords = loc ? toCoords(loc) : null
      if (coords) next = { coords, source: 'device' }
    } catch {
      // A host that throws is treated the same as one that returns null.
    }
  }
  cached = next
  cachedAt = now
  return next
}
