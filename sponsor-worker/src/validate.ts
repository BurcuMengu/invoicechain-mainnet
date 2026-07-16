import { TransactionBuilder, xdr, Address, StrKey } from '@stellar/stellar-sdk'

const ALLOWED_MARKETPLACE_FNS = new Set(['create_invoice', 'buy_invoice', 'settle'])
const ALLOWED_TOKEN_FNS = new Set(['approve'])

export interface AllowlistIds {
  /** Mainnet marketplace contract id. */
  marketplaceId: string
  /** USDC token (SAC) contract id — needed because buy/settle require a preceding token.approve. */
  tokenId: string
}

type Ok = { ok: true; source: string; fn: string }
type Err = { ok: false; status: 403 | 400; msg: string }

/** Parse a signed tx XDR and confirm it is a single InvokeHostFunction calling an
 *  allowlisted function on either the marketplace contract (create_invoice, buy_invoice,
 *  settle) or the USDC token contract (approve). Pure + testable. */
export function validateInvoke(txXdr: string, networkPassphrase: string, ids: AllowlistIds): Ok | Err {
  let tx
  try {
    tx = TransactionBuilder.fromXDR(txXdr, networkPassphrase)
  } catch {
    return { ok: false, status: 400, msg: 'unparseable xdr' }
  }
  const ops = (tx as unknown as { operations: xdr.Operation[] }).operations ?? []
  if (ops.length !== 1) return { ok: false, status: 403, msg: 'expected exactly one operation' }
  const op = ops[0] as unknown as { type: string; func?: xdr.HostFunction }
  if (op.type !== 'invokeHostFunction' || !op.func) return { ok: false, status: 403, msg: 'not an invoke' }
  const ic = op.func.invokeContract()
  const contractId = Address.fromScAddress(ic.contractAddress()).toString()
  const fn = ic.functionName().toString()

  if (contractId === ids.marketplaceId) {
    if (!ALLOWED_MARKETPLACE_FNS.has(fn)) return { ok: false, status: 403, msg: 'function not allowlisted' }
  } else if (contractId === ids.tokenId) {
    if (!ALLOWED_TOKEN_FNS.has(fn)) return { ok: false, status: 403, msg: 'function not allowlisted' }
  } else {
    return { ok: false, status: 403, msg: 'contract not allowlisted' }
  }

  const source = (tx as unknown as { source: string }).source
  if (!StrKey.isValidEd25519PublicKey(source)) return { ok: false, status: 400, msg: 'bad source' }
  return { ok: true, source, fn }
}
