import { parseContractError } from './errors'
import { isSponsorEnabled, submitSponsored } from './feeSponsor'

export class TxError extends Error {}

/**
 * Signs and submits an assembled transaction, returning the parsed result.
 * Wraps contract errors in TxError with a human-readable message.
 */
export async function runTx<T>(assembled: {
  signAndSend: () => Promise<{ result: T }>
}): Promise<T> {
  try {
    const sent = await assembled.signAndSend()
    return sent.result
  } catch (e) {
    throw new TxError(parseContractError(e))
  }
}

/**
 * Returns the simulated result of a read-only assembled transaction.
 * No signing required.
 */
export async function readTx<T>(assembled: { result: T }): Promise<T> {
  return assembled.result
}

export interface SponsorableTx<T> {
  // We only ever call `sign()` with no args; `never` keeps this compatible with
  // the SDK's AssembledTransaction.sign, which takes a richer optional param.
  sign: (opts?: never) => Promise<void>
  signed?: { toXDR(): string } | null
  signAndSend: () => Promise<{ result: T }>
  result: T
}

export type SubmitOutcome<T> = { result: T; sponsored: boolean }

/**
 * Submit an assembled contract call, preferring the fee-sponsor path when it is
 * enabled and succeeds; otherwise fall back to the normal wallet-pays-fee submit.
 * The returned `sponsored` flag drives the "⚡ Gasless" UI hint.
 */
export async function runTxSponsored<T>(assembled: SponsorableTx<T>): Promise<SubmitOutcome<T>> {
  try {
    if (isSponsorEnabled()) {
      await assembled.sign()
      const xdr = assembled.signed?.toXDR()
      if (xdr) {
        const res = await submitSponsored(xdr)
        if (res.sponsored) return { result: assembled.result, sponsored: true }
      }
      // Sponsor unavailable but tx already signed → submit via normal path.
      const sent = await assembled.signAndSend()
      return { result: sent.result, sponsored: false }
    }
    const sent = await assembled.signAndSend()
    return { result: sent.result, sponsored: false }
  } catch (e) {
    throw new TxError(parseContractError(e))
  }
}
