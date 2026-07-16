import { TransactionBuilder, Networks, Operation, Account } from '@stellar/stellar-sdk'

export const PASS = Networks.TESTNET
export const MKT = 'CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD'
export const TOKEN = 'CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3'
export const SRC = 'GD5HVOD6ZANYONRKCCDNQSSOSF5NLVW5UFY4OD4WBXSVM6E43KUB5JY2'

/** Build a signed tx XDR with a single InvokeHostFunction op. */
export function invokeXdr(contractId: string, fnName: string): string {
  const op = Operation.invokeContractFunction({
    contract: contractId,
    function: fnName,
    args: [],
  })
  const tx = new TransactionBuilder(new Account(SRC, '0'), { fee: '100', networkPassphrase: PASS })
    .addOperation(op).setTimeout(30).build()
  return tx.toXDR()
}

/** Build a tx XDR with an InvokeHostFunction op that is NOT an invokeContract
 *  sub-variant (uploadContractWasm) — used to exercise the host-function guard. */
export function uploadWasmXdr(): string {
  const op = Operation.uploadContractWasm({ wasm: Buffer.from([0, 1, 2, 3]) })
  const tx = new TransactionBuilder(new Account(SRC, '0'), { fee: '100', networkPassphrase: PASS })
    .addOperation(op).setTimeout(30).build()
  return tx.toXDR()
}
