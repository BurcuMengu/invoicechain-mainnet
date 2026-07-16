// frontend/src/lib/tx.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as sponsor from './feeSponsor'
import { runTxSponsored } from './tx'

function fakeAssembled<T>(result: T, xdr = 'SIGNED_XDR') {
  return {
    sign: vi.fn(async () => {}),
    signed: { toXDR: () => xdr },
    signAndSend: vi.fn(async () => ({ result })),
    result,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('runTxSponsored', () => {
  it('uses the sponsor path when it succeeds', async () => {
    vi.spyOn(sponsor, 'isSponsorEnabled').mockReturnValue(true)
    vi.spyOn(sponsor, 'submitSponsored').mockResolvedValue({ sponsored: true, hash: 'h1' })
    const asm = fakeAssembled('OK')
    const out = await runTxSponsored(asm)
    expect(out).toEqual({ result: 'OK', sponsored: true })
    expect(asm.sign).toHaveBeenCalledOnce()
    expect(asm.signAndSend).not.toHaveBeenCalled()
  })

  it('falls back to signAndSend when sponsor is unavailable', async () => {
    vi.spyOn(sponsor, 'isSponsorEnabled').mockReturnValue(true)
    vi.spyOn(sponsor, 'submitSponsored').mockResolvedValue({ sponsored: false, reason: 'unavailable' })
    const asm = fakeAssembled('OK')
    const out = await runTxSponsored(asm)
    expect(out).toEqual({ result: 'OK', sponsored: false })
    expect(asm.signAndSend).toHaveBeenCalledOnce()
  })

  it('uses normal path directly when sponsor disabled', async () => {
    vi.spyOn(sponsor, 'isSponsorEnabled').mockReturnValue(false)
    const spy = vi.spyOn(sponsor, 'submitSponsored')
    const asm = fakeAssembled('OK')
    const out = await runTxSponsored(asm)
    expect(out).toEqual({ result: 'OK', sponsored: false })
    expect(spy).not.toHaveBeenCalled()
    expect(asm.signAndSend).toHaveBeenCalledOnce()
  })
})
