import { validateInvoke } from './validate'

interface Env {
  LAUNCHTUBE_URL: string
  LAUNCHTUBE_TOKEN: string
  MARKETPLACE_ID: string
  TOKEN_ID: string
  NETWORK_PASSPHRASE: string
  PER_ADDRESS_LIMIT: string
  PER_IP_DAILY_LIMIT: string
  ALLOWED_ORIGIN: string
  RL: KVNamespace
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  }
}

async function bump(kv: KVNamespace, key: string, ttl?: number): Promise<number> {
  const n = Number((await kv.get(key)) ?? '0') + 1
  await kv.put(key, String(n), ttl ? { expirationTtl: ttl } : undefined)
  return n
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })
    let body: { xdr?: string }
    try { body = await req.json() } catch { return new Response('bad json', { status: 400, headers: cors }) }
    if (!body.xdr) return new Response('missing xdr', { status: 400, headers: cors })

    const v = validateInvoke(body.xdr, env.NETWORK_PASSPHRASE, {
      marketplaceId: env.MARKETPLACE_ID,
      tokenId: env.TOKEN_ID,
    })
    if (!v.ok) return new Response(v.msg, { status: v.status, headers: cors })

    // Per-address lifetime limit
    const addrKey = `addr:${v.source}`
    const addrCount = await bump(env.RL, addrKey)
    if (addrCount > Number(env.PER_ADDRESS_LIMIT)) return new Response('address limit', { status: 429, headers: cors })

    // Per-IP daily limit (KV TTL 24h)
    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown'
    const ipCount = await bump(env.RL, `ip:${ip}`, 86400)
    if (ipCount > Number(env.PER_IP_DAILY_LIMIT)) return new Response('ip limit', { status: 429, headers: cors })

    // Forward to Launchtube (token stays server-side)
    const form = new URLSearchParams({ xdr: body.xdr })
    const res = await fetch(env.LAUNCHTUBE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.LAUNCHTUBE_TOKEN}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) return new Response('launchtube error', { status: 502, headers: cors })
    let data: { hash?: string }
    try { data = await res.json() as { hash?: string } } catch { return new Response('launchtube error', { status: 502, headers: cors }) }
    return new Response(JSON.stringify({ hash: data.hash ?? '' }), { status: 200, headers: { ...cors, 'content-type': 'application/json' } })
  },
}
