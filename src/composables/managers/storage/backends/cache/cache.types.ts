/**
 * @fileoverview CacheStorage backend domain types.
 *
 * ## Overview
 * Types exclusive to the CacheStorage backend. The backend maps each
 * canonical key to a fake internal URL stored inside a named `Cache`
 * object, with the full {@link StorageEnvelope} serialized as the
 * response body (JSON) and critical metadata mirrored into response
 * headers for fast scanning without body reads.
 *
 * ## Why headers mirror metadata
 * `Cache.keys()` only returns `Request` objects — to know *anything*
 * about a cached entry you normally have to call `Cache.match()` and
 * read the response, which means deserializing the body for every entry
 * during a `query()` or TTL sweep. By storing `expires_at`, `weight`,
 * and `schema_version` in custom response headers, the backend can:
 * - Check TTL without a body read.
 * - Filter by `schema_version` without a body read.
 * - Sort candidates for eviction using only header data.
 *
 * Body reads are deferred until the full envelope payload is needed
 * (i.e., a direct `read()` call or a `query()` result).
 *
 * ## Dependency graph (within the Cache module)
 * ```
 * cache.types  <==  cache.transaction
 *             <==  cache.backend
 * ```
 * `cache.types` is a leaf — it imports nothing from the Cache module.
 */

import type { CanonicalKey, ITransaction, ITransactionOp, TransactionStrength } from '../../storage.types'

// ─────────────────────────────────────────────────────────────────────────────
// Backend configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construction-time configuration for {@link CacheBackend}.
 *
 * @example
 * ```ts
 * // Isolate this backend under a specific named cache
 * const backend = new CacheBackend({ cacheName: 'app-storage-v1' })
 *
 * // Default — uses 'storage' as the cache name
 * const backend = new CacheBackend()
 * ```
 */
export interface CacheBackendConfig {
  /**
   * Name of the `Cache` object opened via `caches.open(cacheName)`.
   *
   * Different names isolate independent stores within the same origin.
   * Changing the name effectively creates a new, empty store (the old
   * one remains until explicitly deleted).
   *
   * @defaultValue `'storage'`
   */
  cacheName?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Buffered transaction op
//
// CacheStorage has no native transaction primitive. Ops are accumulated in
// memory and applied atomically (within a single async sequence) on commit.
// "Atomicity" is best-effort: a crash between two `cache.put()` calls will
// leave the store in a partially-written state with no WAL for recovery.
// ─────────────────────────────────────────────────────────────────────────────

/** Discriminant for buffered CacheStorage operations. */
export type CacheOpKind = 'write' | 'delete' | 'clear'

/** A buffered write op — stores the full pre-built `Response` object. */
export interface CacheWriteOp extends ITransactionOp {
  kind:     'write'
  key:      CanonicalKey
  /** Pre-built `Response` object ready to hand to `cache.put()`. */
  response: Response
}

/** A buffered delete op. */
export interface CacheDeleteOp extends ITransactionOp {
  kind: 'delete'
  key:  CanonicalKey
}

/** A buffered clear op (whole store or prefix-filtered). */
export interface CacheClearOp extends ITransactionOp {
  kind:    'clear'
  prefix?: string
}

export type CacheBufferedOp = CacheWriteOp | CacheDeleteOp | CacheClearOp

// ─────────────────────────────────────────────────────────────────────────────
// Cache transaction interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The CacheStorage-specific transaction handle.
 *
 * @remarks
 * Extends {@link ITransaction} with the op-buffering methods called
 * internally by {@link CacheBackend} when a `transactionId` is present on
 * a mutating call.
 *
 * ### Transaction strength: `best-effort`
 * CacheStorage provides no native multi-op transaction primitive. The
 * buffered ops are applied sequentially on `commit()` with no WAL and no
 * crash recovery. A process termination mid-commit leaves the cache in a
 * partially-applied state.
 *
 * `rollback()` (no arg) discards the buffer with zero side effects because
 * nothing has been written yet.
 *
 * The partial-rollback overloads (`rollback(index)`, `rollback(key)`,
 * `rollback(path)`, `rollback(predicate)`) remove individual ops from the
 * live buffer without closing the transaction, letting callers correct a
 * single mistake before committing the rest.
 *
 * @see {@link CacheTransaction} for the concrete implementation.
 */
export interface ICacheTransaction extends ITransaction {
  /** Always `'best-effort'` — CacheStorage cannot provide stronger guarantees. */
  readonly strength: Extract<TransactionStrength, 'best-effort'>
  /**
   * The accumulated op buffer. Exposed read-only for inspection.
   * Do not mutate externally.
   */
  readonly operations: readonly CacheBufferedOp[]
  /** Buffer a write op without touching the cache. */
  bufferWrite(key: CanonicalKey, response: Response): void
  /** Buffer a delete op without touching the cache. */
  bufferDelete(key: CanonicalKey): void
  /** Buffer a clear op without touching the cache. */
  bufferClear(prefix?: string): void
}

// ─────────────────────────────────────────────────────────────────────────────
// Backend configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construction-time configuration for {@link CacheBackend}.
 *
 * @example
 * ```ts
 * // Isolated under a versioned cache name
 * const backend = new CacheBackend({ cacheName: 'app-storage-v2' })
 *
 * // Default name
 * const backend = new CacheBackend()
 * ```
 */
export interface CacheBackendConfig {
  /**
   * Name of the `Cache` object opened via `caches.open(cacheName)`.
   *
   * Different names create independent stores within the same origin.
   * Changing the name effectively starts fresh — the previous named cache
   * persists until explicitly deleted via `caches.delete()`.
   *
   * @defaultValue `'storage'`
   */
  cacheName?: string
}
