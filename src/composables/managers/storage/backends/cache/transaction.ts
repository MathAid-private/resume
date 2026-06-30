/**
 * @fileoverview CacheStorage transaction implementation.
 *
 * ## Overview
 * {@link CacheTransaction} buffers mutation ops (`write`, `delete`, `clear`)
 * in memory until `commit()`. Because CacheStorage provides no native multi‑op
 * atomicity, the transaction is **best‑effort** – a crash during commit leaves
 * the cache partially updated. Rollback (no arguments) discards the buffer
 * with no side effects; partial rollbacks remove specific ops without settling
 * the transaction.
 *
 * @see {@link ICacheTransaction} for the public contract.
 */

import { v4 as uuidV4 } from 'uuid';
import type {
  CanonicalKey,
  ICanonicalKeySegments,
  ITxOpPredicate,
  TransactionStrength,
} from '../../storage.types';
import { buildCanonicalKey, buildModulePrefix, parseCanonicalKey } from '../../storage.util';
import type { CacheBufferedOp, ICacheTransaction } from './cache.types';
import { isNil } from '@/libs';

/** @typedef {import("./cache").CacheBackend} CacheBackend */

/** @import { CacheBackend } from "./cache" */

/**
 * @summary Best‑effort, in‑memory buffered transaction for CacheStorage.
 *
 * @description
 * **What it is**
 * `CacheTransaction` collects write/delete/clear operations in an internal
 * array. The actual CacheStorage API is not touched until `commit()` is called.
 * On commit, all buffered ops are applied sequentially in the order they were
 * added.
 *
 * **Why best‑effort?**
 * CacheStorage has no native transaction primitive. A crash between two
 * `cache.put()` calls leaves the cache partially updated. Rollback is free
 * because nothing has been written yet – we simply discard the buffer.
 *
 * **How to use**
 * Obtain via `CacheBackend.beginTransaction()`. Use the transaction’s `id` in
 * `WriteOptions.transactionId` when calling `write`/`delete`/`clear`. Then
 * `commit()` applies everything, or `rollback()` discards the buffer.
 *
 * @example
 * ```ts
 * const tx = await backend.beginTransaction();
 * try {
 *   await backend.write(keyA, envA, { transactionId: tx.id });
 *   await backend.write(keyB, envB, { transactionId: tx.id });
 *   await tx.commit();  // both writes applied
 * } catch {
 *   await tx.rollback(); // buffer discarded, cache untouched
 * }
 * ```
 *
 * @example
 * ```ts
 * // Remove the second operation (index 1) before commit
 * const removed = await tx.rollback(1);
 * // removed is a tuple [op | undefined]; tx remains open.
 * ```
 *
 * @example
 * ```ts
 * // Remove all operations for a specific canonical key
 * const removed = await tx.rollback('myapp:chrome:130:auth:session');
 * ```
 *
 * @example
 * ```ts
 * // Remove all operations whose key starts with 'myapp:'
 * const removed = await tx.rollback(op => op.key?.startsWith('myapp:') ?? false);
 * ```
 *
 * @see {@link CacheBackend._commitTransaction} for the commit logic.
 */
export class CacheTransaction implements ICacheTransaction {
  readonly id      : string;
  readonly strength: Extract<TransactionStrength, 'best-effort'> = 'best-effort';

  private readonly _ops: CacheBufferedOp[] = [];
  private _settled = false;

  /**
   * @param _onCommit   - Callback invoked when `commit()` is called. Receives
   *   the transaction id and the full op buffer. Owns the actual application
   *   of ops to the cache.
   * @param _onRollback - Callback invoked on full rollback (no‑arg). Used to
   *   deregister the transaction from the backend's active registry.
   */
  constructor(
    private readonly _onCommit: (txId: string, ops: CacheBufferedOp[]) => Promise<void>,
    private readonly _onRollback: (txId: string) => void,
  ) {
    this.id = uuidV4();
  }

  get operations(): readonly CacheBufferedOp[] {
    return this._ops;
  }

  /** @inheritdoc ICacheTransaction.bufferWrite */
  bufferWrite(key: CanonicalKey, response: Response): void {
    this._assertOpen();
    this._ops.push({ kind: 'write', key, response });
  }

  /** @inheritdoc ICacheTransaction.bufferDelete */
  bufferDelete(key: CanonicalKey): void {
    this._assertOpen();
    this._ops.push({ kind: 'delete', key });
  }

  /** @inheritdoc ICacheTransaction.bufferClear */
  bufferClear(prefix?: string): void {
    this._assertOpen();
    this._ops.push({ kind: 'clear', prefix });
  }

  /** @inheritdoc ITransaction.commit */
  async commit(): Promise<void> {
    this._assertOpen();
    this._settled = true;
    await this._onCommit(this.id, this._ops);
  }

  // ── Overloaded rollback ──────────────────────────────────────────────────

  async rollback(): Promise<void>;
  async rollback(index: number): Promise<Readonly<[CacheBufferedOp | undefined]>>;
  async rollback(canonicalKey: CanonicalKey): Promise<ReadonlyArray<CacheBufferedOp>>;
  async rollback(path: ICanonicalKeySegments): Promise<ReadonlyArray<CacheBufferedOp>>;
  async rollback(predicate: ITxOpPredicate): Promise<ReadonlyArray<CacheBufferedOp>>;

  async rollback(
    token?: number | CanonicalKey | ICanonicalKeySegments | ITxOpPredicate,
  ): Promise<void | Readonly<[CacheBufferedOp | undefined]> | ReadonlyArray<CacheBufferedOp>> {
    this._assertOpen();

    // Full rollback: no token → settle and discard buffer
    if (token === undefined) {
      this.terminateAllOps()
      return
    }

    // Partial rollback: remove matching ops, keep transaction open
    const indices: number[] = [];

    if (typeof token === 'number') {
      // Index: remove a single op
      this.stageRemoveOpAt(indices, token);
    } else if (typeof token === 'string') {
      // Exact canonical key match
      await this.stageRemoveOpsMatchingKey(indices, token);
    } else if (typeof token === 'object' && token !== null && 'domain' in token) {
      await this.stageRemoveOpsByCanonicalKeySegments(indices, token);
    } else if (typeof token === 'function') {
      await this.stageRemoveOpsMatching(indices, token)
    }

    // Remove in reverse order to preserve indices
    const removed: CacheBufferedOp[] = [];
    for (const idx of indices) {
      removed.push(this._ops.splice(idx, 1)[0]);
    }

    return Object.freeze(removed)
  }

  // ─────────────────────────────────────────────────────────────────────────

  private _assertOpen(): void {
    if (this._settled) {
      throw new Error(
        `[CacheTransaction:${this.id}] Transaction already settled. ` +
        `Create a new transaction for further operations.`,
      );
    }
  }
  /** @see {@linkcode ICacheTransaction.rollback()} */
  private terminateAllOps() {
    this._settled = true;
    this._ops.length = 0;
    this._onRollback(this.id);
  }
  /** @see {@linkcode ICacheTransaction.rollback ICacheTransaction.rollback(number)} */
  private stageRemoveOpAt(indicesToRemove: number[], index: number) {
    if(index >= 0) indicesToRemove.push(index)
  }
  /** @see {@linkcode ICacheTransaction.rollback ICacheTransaction.rollback(CanonicalKey)} */
  private stageRemoveOpsMatchingKey(indicesToRemove: number[], canonicalKey: CanonicalKey) {
    return new Promise<void>((resolve) => {
      try {
        for (let i = 0; i < this._ops.length; i++) {
          const { key } = this._ops[i];
          if (key === canonicalKey) {
            indicesToRemove.push(i);
          }
        }
        resolve()
      } catch {
        resolve()
      }
    })
  }
  /** @see {@linkcode ICacheTransaction.rollback ICacheTransaction.rollback(ICanonicalKeySegments)} */
  private async stageRemoveOpsByCanonicalKeySegments(
    indicesToRemove: number[],
    path: ICanonicalKeySegments
  ) {
    if(path.actualKey !== undefined)
        return await this.stageRemoveOpsMatchingKey(indicesToRemove, buildCanonicalKey(path))
    const prefix = buildModulePrefix(path)
    return await new Promise<void>((resolve) => {
      try {
        for (let i = 0; i < this._ops.length; i++) {
          const { key } = this._ops[i];
          if(key !== undefined) {
            const opsKeySegment = parseCanonicalKey(key)
            if(!isNil(opsKeySegment) && buildModulePrefix(opsKeySegment) === prefix) {
              indicesToRemove.push(i);
            }
          }
        }
        resolve()
      } catch {
        resolve()
      }
    })
  }
  /** @see {@linkcode ICacheTransaction.rollback ICacheTransaction.rollback(ITxOpPredicate)} */
  private stageRemoveOpsMatching(indicesToRemove: number[], shouldRemove: ITxOpPredicate) {
    return new Promise<void>((resolve) => {
      try {
        for (let i = 0; i < this._ops.length; i++) {
          if (!!shouldRemove(this._ops[i])) {
            indicesToRemove.push(i);
          }
        }
        resolve()
      } catch {
        resolve()
      }
    })
  }
}
