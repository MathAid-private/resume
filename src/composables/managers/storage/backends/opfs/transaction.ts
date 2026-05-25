/**
 * @fileoverview OPFS compensating transaction implementation.
 *
 * ## Overview
 * {@link OPFSTransaction} implements the WAL-backed compensating transaction
 * model for the OPFS backend. It accumulates mutation ops in an in-memory
 * buffer and delegates the actual filesystem work to callbacks provided by
 * {@link OPFSBackend} at construction time.
 *
 * ## Transaction model
 * ```
 *  beginTransaction()
 *       |
 *      \/
 *  OPFSTransaction created (ops = [])
 *       |
 *  write/delete/clear called with transactionId
 *       |
 *      \/
 *  bufferWrite / bufferDelete / bufferClear
 *  -> ops[] grows; zero filesystem activity
 *       |
 *       +--- commit() -------------------------------------+
 *       |         |                                        |
 *       |        \/                                        |
 *       |    _onCommit(ops)                                |
 *       |         | (implemented by OPFSBackend)           |
 *       |        \/                                        |
 *       |    1. write _wal.json          <== crash here:   |
 *       |    2. apply ops to files            nothing applied, WAL replayed on next boot
 *       |    3. rewrite _manifest.json   <== crash here:   |
 *       |    4. clear _wal.json               WAL replayed, manifest rewritten
 *       |    5. delete tx from registry       WAL cleared = done
 *       |                                                  |
 *       +--- rollback() -----------------------------------+
 *                 |
 *                \/
 *            ops.length = 0     (discard buffer)
 *            _onRollback(id)    (remove from backend registry)
 *            <- zero filesystem activity
 * ```
 *
 * ## Strength: compensating
 * OPFS has no native multi-file transaction primitive. The WAL provides
 * crash recovery (any partial commit is completed on next boot) but does
 * **not** provide isolation: a concurrent reader in another tab can observe
 * an intermediate state while ops are being applied between steps 2 and 3.
 * For true isolation, use IndexedDB (`serializable` strength).
 *
 * ## Settled state
 * After either `commit()` or `rollback()`, the transaction is "settled".
 * Any further call to a buffer method or `commit()`/`rollback()` throws
 * immediately. Create a new transaction for subsequent work.
 */

import { v4 as uuidV4 } from 'uuid'

import type { CanonicalKey, TransactionStrength } from '../../storage.types'
import type { IOPFSTransaction, ManifestEntry, WALOp } from './opfs.types'

/**
 * @summary WAL-backed compensating transaction for {@link OPFSBackend}.
 *
 * @description
 * Obtain instances via {@link OPFSBackend.beginTransaction}, not directly.
 * The constructor callbacks tie this transaction to a specific backend instance.
 *
 * ## Overview
 * {@link OPFSTransaction} implements the WAL-backed compensating transaction
 * model for the OPFS backend. It accumulates mutation ops in an in-memory
 * buffer and delegates the actual filesystem work to callbacks provided by
 * {@link OPFSBackend} at construction time.
 *
 * ## Transaction model
 * ```txt
 *  beginTransaction()
 *       |
 *      \/
 *  OPFSTransaction created (ops = [])
 *       |
 *  write/delete/clear called with transactionId
 *       |
 *      \/
 *  bufferWrite / bufferDelete / bufferClear
 *  -> ops[] grows; zero filesystem activity
 *       |
 *       +--- commit() -------------------------------------+
 *       |         |                                        |
 *       |        \/                                        |
 *       |    _onCommit(ops)                                |
 *       |         | (implemented by OPFSBackend)           |
 *       |        \/                                        |
 *       |    1. write _wal.json          <== crash here:   |
 *       |    2. apply ops to files            nothing applied, WAL replayed on next boot
 *       |    3. rewrite _manifest.json   <== crash here:   |
 *       |    4. clear _wal.json               WAL replayed, manifest rewritten
 *       |    5. delete tx from registry       WAL cleared = done
 *       |                                                  |
 *       +--- rollback() -----------------------------------+
 *                 |
 *                \/
 *            ops.length = 0     (discard buffer)
 *            _onRollback(id)    (remove from backend registry)
 *            <- zero filesystem activity
 * ```
 *
 * ## Strength: compensating
 * OPFS has no native multi-file transaction primitive. The WAL provides
 * crash recovery (any partial commit is completed on next boot) but does
 * **not** provide isolation: a concurrent reader in another tab can observe
 * an intermediate state while ops are being applied between steps 2 and 3.
 * For true isolation, use IndexedDB (`serializable` strength).
 *
 * ## Settled state
 * After either `commit()` or `rollback()`, the transaction is "settled".
 * Any further call to a buffer method or `commit()`/`rollback()` throws
 * immediately. Create a new transaction for subsequent work.
 *
 * @example
 * ```ts
 * const tx = await backend.beginTransaction()
 *
 * await backend.write(keyA, envelopeA, { transactionId: tx.id })
 * await backend.write(keyB, envelopeB, { transactionId: tx.id })
 * await backend.delete(keyC,           { transactionId: tx.id })
 *
 * try {
 *   await tx.commit()    // WAL written -> ops applied -> manifest updated -> WAL cleared
 * } catch {
 *   await tx.rollback()  // buffer discarded, no filesystem changes
 * }
 * ```
 *
 * @see {@link IOPFSTransaction} for the full interface contract.
 */
export class OPFSTransaction implements IOPFSTransaction {
  readonly id:       string
  /** Fixed at `'compensating'` — OPFS cannot offer serializable transactions. */
  readonly strength: Extract<TransactionStrength, 'compensating'> = 'compensating'

  /**
   * Accumulated op buffer.
   *
   * @description
   * Populated by the `buffer*` methods. Read by `_onCommit` to construct
   * the WAL and apply mutations. Discarded (set to length 0) on rollback.
   * Exposed as `readonly ops` on {@link IOPFSTransaction} for inspection;
   * external callers must not mutate this array.
   */
  readonly ops: WALOp[] = []

  /**
   * Flag for open/close status
   */
  private _settled = false

  /**
   * @param _onCommit   — Provided by {@link OPFSBackend._commitTransaction}.
   *   Receives the full op buffer and owns all filesystem work: WAL write,
   *   op application, manifest rewrite, WAL clear.
   * @param _onRollback — Provided by {@link OPFSBackend}. Removes this
   *   transaction from the backend's active-transaction registry so it can
   *   be garbage collected.
   */
  constructor(
    private readonly _onCommit:   (txId: string, ops: WALOp[]) => Promise<void>,
    private readonly _onRollback: (id: string)   => void,
  ) {
    this.id = uuidV4()
  }

  // ── Buffer methods ────────────────────────────────────────────────────────
  // Called by OPFSBackend when a transactionId is present on a mutating call.
  // These are the only methods that add to ops[]; they touch no filesystem.

  /**
   * Buffer a write op.
   *
   * @param key        - Canonical key being written.
   * @param filePath   - OPFS-relative path for the data file.
   * @param payloadB64 - Base64-encoded encrypted payload bytes.
   * @param meta       - Manifest metadata for this entry.
   */
  bufferWrite(
    key:         CanonicalKey,
    filePath:    string,
    payloadB64:  string,
    meta:        ManifestEntry,
  ): void {
    this._assertOpen()
    this.ops.push({ kind: 'write', key, filePath, payloadB64, meta })
  }

  /**
   * Buffer a delete op.
   *
   * @param key      - Canonical key to delete.
   * @param filePath - OPFS-relative path for the data file to remove.
   */
  bufferDelete(key: CanonicalKey, filePath: string): void {
    this._assertOpen()
    this.ops.push({ kind: 'delete', key, filePath })
  }

  /**
   * Buffer a clear op.
   *
   * @param prefix - If supplied, only keys starting with this prefix are
   *   cleared. If omitted, the entire store is cleared on commit.
   */
  bufferClear(prefix?: string): void {
    this._assertOpen()
    this.ops.push({ kind: 'clear', prefix })
  }

  // ── ITransaction ──────────────────────────────────────────────────────────

  /**
   * Commit all buffered ops to OPFS.
   *
   * @description
   * Delegates entirely to `_onCommit`, which is implemented by
   * {@link OPFSBackend._commitTransaction}. See that method's documentation
   * for the exact commit sequence and crash-recovery guarantees.
   *
   * After this resolves, the transaction is settled and cannot be reused.
   *
   * @throws If any filesystem step fails. The WAL is preserved on disk for
   * crash recovery — {@link OPFSBackend.initialize} will replay it on the
   * next boot.
   */
  async commit(): Promise<void> {
    this._assertOpen()
    this._settled = true
    await this._onCommit(this.id, this.ops)
  }

  /**
   * Discard all buffered ops without touching the filesystem.
   *
   * @description
   * Because no filesystem writes occur until `commit()`, rollback is
   * guaranteed to be clean: there is nothing to undo. The op buffer is
   * cleared and `_onRollback` notifies the backend to deregister this
   * transaction.
   *
   * After this resolves, the transaction is settled and cannot be reused.
   */
  async rollback(): Promise<void> {
    this._assertOpen()
    this._settled = true
    this.ops.length = 0
    this._onRollback(this.id)
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Assert the transaction has not yet been committed or rolled back.
   * @throws {Error} If the transaction is already settled.
   */
  private _assertOpen(): void {
    if (this._settled) {
      throw new Error(
        `[OPFSTransaction:${this.id}] Transaction is already settled. ` +
        `Create a new transaction for further operations.`
      )
    }
  }
}
