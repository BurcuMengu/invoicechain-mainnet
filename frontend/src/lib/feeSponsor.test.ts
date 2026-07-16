// frontend/src/lib/feeSponsor.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isSponsorEnabled, submitSponsored } from './feeSponsor'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('feeSponsor', () => {
  it('is disabled when VITE_SPONSOR_URL is unset', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', '')
    expect(isSponsorEnabled()).toBe(false)
    expect(await submitSponsored('XDR')).toEqual({ sponsored: false, reason: 'disabled' })
  })

  it('returns hash on a 2xx sponsor response', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', 'https://sponsor.example/submit')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hash: 'abc123' }), { status: 200 })))
    expect(await submitSponsored('XDR')).toEqual({ sponsored: true, hash: 'abc123' })
  })

  it('falls back (unavailable) on 429/403/5xx', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', 'https://sponsor.example/submit')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 429 })))
    expect(await submitSponsored('XDR')).toEqual({ sponsored: false, reason: 'unavailable' })
  })

  it('falls back (unavailable) on a network error', async () => {
    vi.stubEnv('VITE_SPONSOR_URL', 'https://sponsor.example/submit')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await submitSponsored('XDR')).toEqual({ sponsored: false, reason: 'unavailable' })
  })
})
