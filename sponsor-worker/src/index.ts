import { validateInvoke } from './validate'

interface Env {
  LAUNCHTUBE_URL: string
  LAUNCHTUBE_TOKEN: string
  MARKETPLACE_ID: string
  TOKEN_ID: string
  NETWORK_PASSPHRASE: string
  PER_ADDRESS_LIMIT: string
  PER_IP_DAILY_LIMIT: string
  RL: KVNamespace
}

async function bump(kv: KVNamespace, key: string, ttl?: number): Promise<number> {
  const n = Number((await kv.get(key)) ?? '0') + 1
  await kv.put(key, String(n), ttl ? { expirationTtl: ttl } : undefined)
  return n
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
    let body: { xdr?: string }
    try { body = await req.json() } catch { return new Response('bad json', { status: 400 }) }
    if (!body.xdr) return new Response('missing xdr', { status: 400 })

    const v = validateInvoke(body.xdr, env.NETWORK_PASSPHRASE, {
      marketplaceId: env.MARKETPLACE_ID,
      tokenId: env.TOKEN_ID,
    })
    if (!v.ok) return new Response(v.msg, { status: v.status })

    // Per-address lifetime limit
    const addrKey = `addr:${v.source}`
    const addrCount = await bump(env.RL, addrKey)
    if (addrCount > Number(env.PER_ADDRESS_LIMIT)) return new Response('address limit', { status: 429 })

    // Per-IP daily limit (KV TTL 24h)
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown'
    const ipCount = await bump(env.RL, `ip:${ip}`, 86400)
    if (ipCount > Number(env.PER_IP_DAILY_LIMIT)) return new Response('ip limit', { status: 429 })

    // Forward to Launchtube (token stays server-side)
    const form = new URLSearchParams({ xdr: body.xdr })
    const res = await fetch(env.LAUNCHTUBE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.LAUNCHTUBE_TOKEN}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) return new Response('launchtube error', { status: 502 })
    const data = await res.json() as { hash?: string }
    return new Response(JSON.stringify({ hash: data.hash ?? '' }), { status: 200, headers: { 'content-type': 'application/json' } })
  },
}
