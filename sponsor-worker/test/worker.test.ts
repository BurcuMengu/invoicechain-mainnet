import { describe, expect, it, vi } from 'vitest'
import worker from '../src/index'
import { MKT, TOKEN, invokeXdr } from './helpers'

// A minimal in-memory KV double:
function kv() {
  const m = new Map<string, string>()
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, val: string) => void m.set(k, val) } as unknown as KVNamespace
}
const baseEnv = () => ({
  LAUNCHTUBE_URL: 'https://lt.example', LAUNCHTUBE_TOKEN: 'secret',
  MARKETPLACE_ID: MKT,
  TOKEN_ID: TOKEN,
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  PER_ADDRESS_LIMIT: '3', PER_IP_DAILY_LIMIT: '50', RL: kv(),
})
function post(xdr: string) {
  return new Request('https://w/', { method: 'POST', headers: { 'cf-connecting-ip': '1.2.3.4' }, body: JSON.stringify({ xdr }) })
}

const validXdr = invokeXdr(MKT, 'buy_invoice')

describe('sponsor worker', () => {
  it('forwards a valid request and returns the hash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hash: 'h9' }), { status: 200 })))
    const res = await worker.fetch(post(validXdr), baseEnv())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ hash: 'h9' })
  })
  it('429s after PER_ADDRESS_LIMIT sponsored txs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ hash: 'h' }), { status: 200 })))
    const env = baseEnv()
    for (let i = 0; i < 3; i++) await worker.fetch(post(validXdr), env)
    const res = await worker.fetch(post(validXdr), env)
    expect(res.status).toBe(429)
  })
})
