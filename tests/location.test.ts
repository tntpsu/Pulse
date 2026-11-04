import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_COORDS,
  LOCATION_TTL_MS,
  resolveCoords,
  setLocationProvider,
  toCoords,
} from '../src/location'

beforeEach(() => setLocationProvider(null))

describe('toCoords', () => {
  it('rounds to four decimals', () => {
    expect(toCoords({ latitude: 40.44062345, longitude: -79.99589999 })).toEqual({ lat: '40.4406', lon: '-79.9959' })
  })

  it('rejects out-of-range, non-finite and null-island fixes', () => {
    expect(toCoords({ latitude: 91, longitude: 0 })).toBeNull()
    expect(toCoords({ latitude: 0, longitude: 181 })).toBeNull()
    expect(toCoords({ latitude: Number.NaN, longitude: 1 })).toBeNull()
    expect(toCoords({ latitude: 0, longitude: 0 })).toBeNull()
  })
})

describe('resolveCoords', () => {
  it('uses the env defaults when no provider is set', async () => {
    expect(await resolveCoords()).toEqual({ coords: DEFAULT_COORDS, source: 'default' })
  })

  it('uses the device fix when the provider returns one', async () => {
    setLocationProvider(async () => ({ latitude: 37.7749, longitude: -122.4194 }))
    expect(await resolveCoords()).toEqual({ coords: { lat: '37.7749', lon: '-122.4194' }, source: 'device' })
  })

  it('falls back to defaults when the provider returns null or throws', async () => {
    setLocationProvider(async () => null)
    expect((await resolveCoords()).source).toBe('default')
    setLocationProvider(async () => { throw new Error('denied') })
    expect((await resolveCoords()).source).toBe('default')
  })

  it('caches a fix for the TTL and asks again after it', async () => {
    const provider = vi.fn(async () => ({ latitude: 1, longitude: 2 }))
    setLocationProvider(provider)
    await resolveCoords(1_000)
    await resolveCoords(1_000 + LOCATION_TTL_MS - 1)
    expect(provider).toHaveBeenCalledTimes(1)
    await resolveCoords(1_000 + LOCATION_TTL_MS)
    expect(provider).toHaveBeenCalledTimes(2)
  })

  it('caches a default result too, so a denied permission is not re-asked every poll', async () => {
    const provider = vi.fn(async () => null)
    setLocationProvider(provider)
    await resolveCoords(0)
    await resolveCoords(10)
    expect(provider).toHaveBeenCalledTimes(1)
  })
})
