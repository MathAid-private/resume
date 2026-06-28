import { v4 as uuidV4 } from 'uuid'

import type { CanonicalKey, StorageEnvelope, TransactionStrength, ITransaction, ITransactionOp, ITxOpPredicate } from '../../storage.types'

export interface BufferedOp<TRaw> extends ITransactionOp {
  envelope?: StorageEnvelope<TRaw>
}

/**
 * ### MemoryTransaction
 * strength: best-effort
 *
 * Ops are buffered and applied to the store map atomically in JS (single
 * thread). "Rollback" means discarding the buffer - no actual undo needed
 * because nothing was written yet.
 */

export class MemoryTransaction<TRaw> implements ITransaction {
  readonly id:       string
  readonly strength: TransactionStrength = 'best-effort'

  private readonly _ops: BufferedOp<TRaw>[] = []
  private _settled = false

  get operations() {
    return this._ops as (Readonly<typeof this._ops>) //Object.freeze(this._ops)
  }

  constructor(
    private readonly _store: Map<CanonicalKey, StorageEnvelope<TRaw>>,
    private readonly _onCommit: (txId: string, ops: BufferedOp<TRaw>[]) => void,
    private readonly _onRollback?: (txId: string) => void,
  ) {
    this.id = uuidV4()
  }

  // ── Internal: called by MemoryBackend to buffer ops ─────────────────────

  bufferWrite(key: CanonicalKey, envelope: StorageEnvelope<TRaw>) {
    this._assertOpen()
    this._ops.push({ kind: 'write', key, envelope })
  }

  bufferDelete(key: CanonicalKey) {
    this._assertOpen()
    this._ops.push({ kind: 'delete', key })
  }

  bufferClear(prefix?: string) {
    this._assertOpen()
    this._ops.push({ kind: 'clear', prefix })
  }

  // ── ITransaction ─────────────────────────────────────────────────────────

  async commit(): Promise<void> {
    this._assertOpen()
    this._settled = true
    try {
      this._onCommit(this.id, this._ops)
    } catch (cause) {
      await this.rollback()
      throw new ReferenceError("An op threw. Rollback was applied", {
        cause
      })
    }
  }

  async rollback(token?: ITxOpPredicate | string | number): Promise<void | Readonly<BufferedOp<TRaw>>[]> {
    this._assertOpen()
    if(!token) {
      this._settled = true
      // Discard the buffer - nothing was written, so no undo needed.
      this._ops.length = 0
      this._onRollback?.(this.id)
    } else {
      return new Promise((resolve, reject) => {
        try {
          const toBeDeleted: number[] = []
          if(typeof token === 'number') {
            const op = this._ops[token]
            if(op) toBeDeleted.push(token)
          } else {
            for (let i = 0; i < this._ops.length; i++) {
              const op = this._ops[i]
              if((typeof token === 'string' && op.key === token) ||
                typeof token === 'function' && !!token(op)
              ) {
                toBeDeleted.push(i)
              }
            }
          }
          const deleted = []
          for (const i of toBeDeleted) {
            deleted.push(Object.freeze(this._ops.splice(i, 1)[0]))
          }
          resolve(deleted)
        } catch (error) {
          reject(error)
        }
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _assertOpen() {
    if (this._settled) {
      throw new Error(`[MemoryTransaction:${this.id}] Transaction already settled.`)
    }
  }
}
