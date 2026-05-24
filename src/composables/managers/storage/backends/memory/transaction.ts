import { v4 as uuidV4 } from 'uuid'

import type { ITransaction } from '../../storage.types'
import type { CanonicalKey, StorageEnvelope, TransactionStrength } from '../../storage.types'

/**
 * Buffered op (used by compensating + best-effort transactions)
 */
export type BufferedOpKind = 'write' | 'delete' | 'clear'

export interface BufferedOp<TRaw> {
  kind:      BufferedOpKind
  key?:      CanonicalKey
  envelope?: StorageEnvelope<TRaw>
  prefix?:   string
}

/**
 * ### MemoryTransaction
 * strength: best-effort
 *
 * Ops are buffered and applied to the store map atomically in JS (single
 * thread). "Rollback" means discarding the buffer — no actual undo needed
 * because nothing was written yet.
 */

export class MemoryTransaction<TRaw> implements ITransaction {
  readonly id:       string
  readonly strength: TransactionStrength = 'best-effort'

  private readonly _ops: BufferedOp<TRaw>[] = []
  private _settled = false

  constructor(
    private readonly _store: Map<CanonicalKey, StorageEnvelope<TRaw>>,
    private readonly _onCommit: (txId: string, ops: BufferedOp<TRaw>[]) => void,
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
    this._onCommit(this.id, this._ops)
  }

  async rollback(): Promise<void> {
    this._assertOpen()
    this._settled = true
    // Discard the buffer — nothing was written, so no undo needed.
    this._ops.length = 0
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _assertOpen() {
    if (this._settled) {
      throw new Error(`[MemoryTransaction:${this.id}] Transaction already settled.`)
    }
  }
}
