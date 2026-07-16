// frontend/src/lib/feeSponsor.ts
export type SponsorResult =
  | { sponsored: true; hash: string }
  | { sponsored: false; reason: 'disabled' | 'unavailable' }

const sponsorUrl = (): string => (import.meta.env.VITE_SPONSOR_URL as string | undefined) ?? ''

export function isSponsorEnabled(): boolean {
  return sponsorUrl() !== ''
}

/** POST a signed invoke XDR to the sponsor Worker. Never throws — any problem
 *  resolves to { sponsored: false } so the caller can fall back to normal submit. */
export async function submitSponsored(signedXdr: string): Promise<SponsorResult> {
  const url = sponsorUrl()
  if (url === '') return { sponsored: false, reason: 'disabled' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ xdr: signedXdr }),
    })
    if (!res.ok) return { sponsored: false, reason: 'unavailable' }
    const data = (await res.json()) as { hash: string }
    return { sponsored: true, hash: data.hash }
  } catch {
    return { sponsored: false, reason: 'unavailable' }
  }
}
