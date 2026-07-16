import { describe, expect, it } from 'vitest'
import { validateInvoke } from '../src/validate'
import { PASS, MKT, TOKEN, SRC, invokeXdr, uploadWasmXdr } from './helpers'

const IDS = { marketplaceId: MKT, tokenId: TOKEN }

describe('validateInvoke', () => {
  it('accepts an allowlisted marketplace fn (buy_invoice)', () => {
    const r = validateInvoke(invokeXdr(MKT, 'buy_invoice'), PASS, IDS)
    expect(r).toEqual({ ok: true, source: SRC, fn: 'buy_invoice' })
  })
  it('accepts token approve', () => {
    const r = validateInvoke(invokeXdr(TOKEN, 'approve'), PASS, IDS)
    expect(r).toEqual({ ok: true, source: SRC, fn: 'approve' })
  })
  it('rejects a non-allowlisted contract', () => {
    const other = 'CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K'
    const r = validateInvoke(invokeXdr(other, 'buy_invoice'), PASS, IDS)
    expect(r.ok).toBe(false)
  })
  it('rejects a non-allowlisted marketplace function (set_paused)', () => {
    const r = validateInvoke(invokeXdr(MKT, 'set_paused'), PASS, IDS)
    expect(r.ok).toBe(false)
  })
  it('rejects token with a non-approve fn', () => {
    const r = validateInvoke(invokeXdr(TOKEN, 'transfer'), PASS, IDS)
    expect(r.ok).toBe(false)
  })
  it('rejects a non-invoke host function (uploadContractWasm) with 403, not a throw', () => {
    const r = validateInvoke(uploadWasmXdr(), PASS, IDS)
    expect(r).toEqual({ ok: false, status: 403, msg: 'not a contract invocation' })
  })
})
