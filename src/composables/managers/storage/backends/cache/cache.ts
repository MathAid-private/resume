/**
 * @fileoverview CacheStorage backend implementation.
 *
 * ## Overview
 * {@link CacheBackend} implements `IStorageBackend<string>` using the browser's
 * `CacheStorage` API (accessible via `caches`). Each entry is stored as a
 * `Response` object inside a named cache, with the full `StorageEnvelope`
 * serialised as JSON in the response body and critical metadata mirrored in
 * custom HTTP headers for fast scanning without body reads.
 *
 * ## Why headers?
 * `Cache.keys()` only returns `Request` objects – to know anything about an
 * entry you normally have to call `Cache.match()` and read the body. By
 * storing `expires_at`, `weight`, and `schema_version` in headers, we can:
 * - Check TTL without a body read.
 * - Filter by `schema_version` without a body read.
 * - Sort eviction candidates using only header data.
 *
 * ## Transaction strength: `best‑effort`
 * CacheStorage provides no native multi‑op atomicity. Transactions buffer ops
 * in memory and apply them sequentially on `commit()`. A crash mid‑commit
 * leaves the cache partially updated – no WAL or recovery is provided.
 *
 * @see {@link IStorageBackend} for the full interface contract.
 * @see {@link CacheTransaction} for the transaction implementation.
 */

import type {
  BackendKind,
  CanonicalKey,
  CapabilityResult,
  EvictionPolicy,
  IStorageBackend,
  ITransaction,
  QuotaEstimate,
  ReadOptions,
  StorageEnvelope,
  StorageQuery,
  TransactionStrength,
  WriteOptions,
} from '../../storage.types';
import { HDR_SCHEMA_VERSION } from './cache.const';
import type { CacheBackendConfig, CacheBufferedOp } from './cache.types';
import { buildResponse, extractEnvelope, getContentLength, getExpiresAtFromHeaders, keyToUrl, urlToKey } from './cache.util';
import { CacheTransaction } from './transaction';

/**
 * @summary CacheStorage backend – stores entries as HTTP responses in a named `Cache`.
 *
 * @description
 * **What it is**
 * A storage adapter that uses the browser's `CacheStorage` API. Each canonical key
 * is mapped to a fake URL (`https://storage.internal/<encoded-key>`). The entry is
 * stored as a `Response` whose body contains the JSON‑serialised `StorageEnvelope`,
 * and whose headers mirror the envelope's metadata.
 *
 * **Why use it?**
 * CacheStorage is available in all modern browsers and can hold large amounts of
 * data (subject to the browser's storage quota). It is a viable persistent backend
 * alongside OPFS and IndexedDB, and it can be used as a fallback or even as a
 * primary store in environments where OPFS/IDB are restricted.
 *
 * **How to use**
 * Create an instance with optional `cacheName`, call `probe()` to check availability,
 * `initialize()` to open the cache, then use the standard `write`/`read`/`delete`
 * methods. Transactions are best‑effort – use `beginTransaction()` for batching.
 *
 * @example
 * ```ts
 * const backend = new CacheBackend({ cacheName: 'my-app-v1' });
 * const probe = await backend.probe();
 * if (probe.available) {
 *   await backend.initialize();
 *   await backend.write(key, envelope);
 *   const read = await backend.read(key);
 *   await backend.close();
 * }
 * ```
 *
 * @example
 * ```ts
 * // Transactional batching
 * const tx = await backend.beginTransaction();
 * await backend.write(keyA, envA, { transactionId: tx.id });
 * await backend.delete(keyB, { transactionId: tx.id });
 * await tx.commit(); // both applied
 * ```
 *
 * @see {@link IStorageBackend}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage | MDN: CacheStorage}
 */
export class CacheBackend implements IStorageBackend<string> {
  readonly kind               : BackendKind         = 'cache';
  readonly transactionStrength: TransactionStrength = 'best-effort';
  /**
   * Priority in the fallback chain. Set to 2 (between localstorage=1 and sessionstorage=3)
   * to give CacheStorage a chance before less durable backends.
   */
  readonly priority: number = 2;

  private _cacheName   : string;
  private _cache       : Cache | null                  = null;
  private _initialized : boolean                       = false;
  private _transactions: Map<string, CacheTransaction> = new Map();

  constructor(config: CacheBackendConfig = {}) {
    this._cacheName = config.cacheName ?? 'storage';
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * @summary Perform a smoke test to verify CacheStorage is accessible and writable.
   *
   * @description
   * Opens the named cache, writes a temporary entry, reads it back, verifies the
   * round‑trip, and deletes the entry. Returns `{ available: true, latency }` on
   * success, otherwise `{ available: false, reason }`.
   *
   * @returns {Promise<CapabilityResult>}
   */
  async probe(): Promise<CapabilityResult> {
    const start = performance.now();
    try {
      if (typeof caches === 'undefined') {
        return { available: false, reason: 'caches API not available' };
      }
      const cache = await caches.open(this._cacheName);
      const testKey = '__probe__' as CanonicalKey;
      const url = keyToUrl(testKey);
      const response = new Response('probe', { headers: { 'Content-Type': 'text/plain' } });
      await cache.put(url, response);
      const match = await cache.match(url);
      if (!match) return { available: false, reason: 'Read after write failed' };
      const text = await match.text();
      if (text !== 'probe') return { available: false, reason: 'Data mismatch' };
      await cache.delete(url);
      return { available: true, latency: performance.now() - start };
    } catch (err) {
      return {
        available: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * @summary Open the named cache and mark the backend as ready.
   *
   * @param signal - Optional abort signal; checked before opening.
   * @throws {Error} If the cache cannot be opened.
   */
  async initialize(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    this._cache = await caches.open(this._cacheName);
    this._initialized = true;
  }

  /**
   * @summary Roll back all pending transactions, release the cache reference.
   *
   * @description
   * Does not delete any stored data – the cache remains on disk.
   * A subsequent `initialize()` will re‑open the same cache.
   */
  async close(): Promise<void> {
    for (const tx of this._transactions.values()) {
      try {
        await tx.rollback();
      } catch {
        /* ignore */
      }
    }
    this._transactions.clear();
    this._cache = null;
    this._initialized = false;
  }

  // ── Core CRUD ─────────────────────────────────────────────────────────────

  /**
   * @summary Write an envelope under the given key.
   *
   * @description
   * If `options.transactionId` is provided, the write is buffered inside that
   * transaction and the cache is not touched until `commit()`. Otherwise the
   * write is applied immediately.
   *
   * @param key        - Canonical key.
   * @param envelope   - Storage envelope with payload already serialised.
   * @param options    - May contain `transactionId`.
   * @throws {Error} If not initialised or the transaction does not exist.
   */
  async write(
    key: CanonicalKey,
    envelope: StorageEnvelope<string>,
    options?: WriteOptions,
  ): Promise<void> {
    this._assertInitialized();
    const response = buildResponse(envelope);
    if (options?.transactionId) {
      const tx = this._getTransaction(options.transactionId);
      tx.bufferWrite(key, response);
      return;
    }
    await this._cache!.put(keyToUrl(key), response);
  }

  /**
   * @summary Read the raw envelope stored under `key`, or `null` if absent.
   *
   * @description
   * Checks TTL from headers before reading the body. If expired and
   * `respectTtl` is `true` (default), the entry is deleted and `null` is returned.
   *
   * @param key     - Canonical key.
   * @param options - May include `respectTtl` (default true).
   * @returns The envelope or `null`.
   */
  async read(
    key: CanonicalKey,
    options?: ReadOptions,
  ): Promise<StorageEnvelope<string> | null> {
    this._assertInitialized();
    const url = keyToUrl(key);
    const response = await this._cache!.match(url);
    if (!response) return null;

    const expiresAt = getExpiresAtFromHeaders(response.headers);
    if (options?.respectTtl !== false && expiresAt !== null && expiresAt < Date.now()) {
      await this._cache!.delete(url);
      return null;
    }
    return extractEnvelope(response);
  }

  /**
   * @summary Delete a single entry.
   *
   * @param key     - Canonical key.
   * @param options - May contain `transactionId` to buffer the operation.
   * @returns Resolves silently if the key does not exist.
   */
  async delete(
    key: CanonicalKey,
    options?: { transactionId?: string; signal?: AbortSignal },
  ): Promise<void> {
    this._assertInitialized();
    if (options?.transactionId) {
      const tx = this._getTransaction(options.transactionId);
      tx.bufferDelete(key);
      return;
    }
    await this._cache!.delete(keyToUrl(key));
  }

  /**
   * @summary Delete all entries whose canonical key starts with `prefix`.
   *
   * @description
   * If `prefix` is omitted, the entire cache is deleted and re‑opened.
   * If a transaction is active, the operation is buffered.
   *
   * @param prefix  - Optional key prefix.
   * @param options - May contain `signal` or `transactionId`.
   */
  async clear(
    prefix?: string,
    options?: { signal?: AbortSignal; transactionId?: string },
  ): Promise<void> {
    this._assertInitialized();
    if (options?.transactionId) {
      const tx = this._getTransaction(options.transactionId);
      tx.bufferClear(prefix);
      return;
    }

    if (!prefix) {
      // Delete entire cache and re‑open
      await caches.delete(this._cacheName);
      this._cache = await caches.open(this._cacheName);
      return;
    }

    const requests = await this._cache!.keys();
    for (const req of requests) {
      options?.signal?.throwIfAborted();
      const key = urlToKey(req.url);
      if (key && key.startsWith(prefix)) {
        await this._cache!.delete(req);
      }
    }
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /**
   * @summary Return all raw envelopes matching the query criteria.
   *
   * @description
   * Iterates over all cache keys. For each, checks expiry and schema version
   * from headers without reading the body. Only when a match passes those
   * filters is the body read and deserialised.
   *
   * Expired entries are deleted lazily during the scan.
   *
   * @param q       - Query parameters (prefix, schema_version, excludeExpired, limit, offset).
   * @param options - Abort signal.
   * @returns Array of matching key/envelope pairs.
   */
  async query(
    q: StorageQuery,
    options?: { signal?: AbortSignal },
  ): Promise<Array<{ key: CanonicalKey; envelope: StorageEnvelope<string> }>> {
    this._assertInitialized();
    const results: Array<{ key: CanonicalKey; envelope: StorageEnvelope<string> }> = [];
    const requests = await this._cache!.keys();

    for (const req of requests) {
      options?.signal?.throwIfAborted();
      const key = urlToKey(req.url);
      if (!key) continue;
      if (q.prefix && !key.startsWith(q.prefix)) continue;

      const response = await this._cache!.match(req);
      if (!response) continue;

      // TTL check via headers
      const expiresAt = getExpiresAtFromHeaders(response.headers);
      if (q.excludeExpired !== false && expiresAt !== null && expiresAt < Date.now()) {
        await this._cache!.delete(req);
        continue;
      }

      const schemaVersion = Number(response.headers.get(HDR_SCHEMA_VERSION));
      if (q.schema_version !== undefined && schemaVersion !== q.schema_version) continue;

      // Read body only now
      const envelope = await extractEnvelope(response);
      results.push({ key, envelope });
    }

    const offset = q.offset ?? 0;
    const limit = q.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  /**
   * @summary Return the number of entries matching the optional prefix.
   *
   * @description
   * Uses `cache.keys()` to count without reading any response bodies.
   *
   * @param prefix - Optional key prefix.
   * @returns The count.
   */
  async count(prefix?: string): Promise<number> {
    this._assertInitialized();
    const requests = await this._cache!.keys();
    if (!prefix) return requests.length;
    let count = 0;
    for (const req of requests) {
      const key = urlToKey(req.url);
      if (key && key.startsWith(prefix)) count++;
    }
    return count;
  }

  // ── Transactions ──────────────────────────────────────────────────────────

  /**
   * @summary Open a new best‑effort transaction.
   *
   * @param strength - Must be `'best-effort'` or omitted. Any other value throws.
   * @returns A {@link CacheTransaction} instance.
   * @throws If `strength` is not `'best-effort'`.
   */
  async beginTransaction(strength?: TransactionStrength): Promise<ITransaction> {
    this._assertInitialized();
    if (strength && strength !== 'best-effort') {
      throw new Error(
        `[CacheBackend] Requested transaction strength "${strength}" but ` +
        `only "best-effort" is supported.`,
      );
    }
    const tx = new CacheTransaction(
      (txId, ops) => this._commitTransaction(txId, ops),
      (txId) => this._transactions.delete(txId),
    );
    this._transactions.set(tx.id, tx);
    return tx;
  }

  /**
   * @inheritdoc IStorageBackend.isTransactionActive
   */
  isTransactionActive(txId?: string): boolean {
    if (!txId) return this._transactions.size > 0;
    return this._transactions.has(txId);
  }

  // ── Quota ─────────────────────────────────────────────────────────────────

  /**
   * @summary Estimate storage usage for the origin.
   *
   * @description
   * Delegates to `navigator.storage.estimate()`, which includes CacheStorage
   * usage. If that API is unavailable, falls back to a rough sum of
   * `Content-Length` headers (or body lengths) with a 50 MB soft cap.
   *
   * @returns {Promise<QuotaEstimate>}
   */
  async estimateQuota(): Promise<QuotaEstimate> {
    this._assertInitialized();
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota ?? 0;
      const used = estimate.usage ?? 0;
      return {
        used,
        available: Math.max(0, quota - used),
        ratio: quota > 0 ? used / quota : 0,
      };
    } catch {
      // Fallback: sum Content-Length or body sizes
      let total = 0;
      const requests = await this._cache!.keys();
      for (const req of requests) {
        const response = await this._cache!.match(req);
        if (response) {
          const len = response.headers.get('Content-Length');
          if (len) total += Number(len);
          else {
            const text = await response.clone().text();
            total += text.length;
          }
        }
      }
      const softCap = 50 * 1024 * 1024;
      return {
        used: total,
        available: Math.max(0, softCap - total),
        ratio: Math.min(1, total / softCap),
      };
    }
  }

  /**
   * @summary Evict entries to reclaim storage space.
   *
   * @description
   * **Phase 1** – Delete all expired entries. If enough bytes are freed,
   * return immediately.
   *
   * **Phase 2** – Sort remaining entries by `weight` (ascending). Tie‑break
   * using the chosen `policy` (only `lru`/`fifo` are implemented; `lfu` falls
   * back to `written_at`). Delete until `freed >= targetBytes`.
   *
   * @param targetBytes - Stop after freeing this many bytes.
   * @param policy      - Tie‑breaking policy.
   * @param comparator  - Custom comparator for `policy === 'user'`.
   * @returns The number of bytes actually freed.
   */
  async evict(
    targetBytes: number,
    policy: EvictionPolicy,
    comparator?: (
      a: { key: CanonicalKey; envelope: StorageEnvelope<string> },
      b: { key: CanonicalKey; envelope: StorageEnvelope<string> },
    ) => number,
  ): Promise<number> {
    this._assertInitialized();

    // Gather all entries with their responses and sizes
    const entries: Array<{
      key: CanonicalKey;
      envelope: StorageEnvelope<string>;
      response: Response;
      size: number;
    }> = [];

    const requests = await this._cache!.keys();
    for (const req of requests) {
      const key = urlToKey(req.url);
      if (!key) continue;
      const response = await this._cache!.match(req);
      if (!response) continue;
      const envelope = await extractEnvelope(response);
      const size = getContentLength(response.headers) || JSON.stringify(envelope).length;
      entries.push({ key, envelope, response, size });
    }

    // Phase 1: delete expired
    let freed = 0;
    const now = Date.now();
    const remaining = entries.filter(entry => {
      if (entry.envelope.expires_at !== null && entry.envelope.expires_at < now) {
        freed += entry.size;
        // Delete immediately (best effort)
        this._cache!.delete(keyToUrl(entry.key));
        return false;
      }
      return true;
    });

    if (freed >= targetBytes) return freed;

    // Phase 2: sort remaining by weight and tie‑break
    remaining.sort((a, b) => {
      const diff = a.envelope.weight - b.envelope.weight;
      if (diff !== 0) return diff;
      if (policy === 'user' && comparator) {
        return comparator(
          { key: a.key, envelope: a.envelope },
          { key: b.key, envelope: b.envelope },
        );
      }
      return this._defaultTieBreak(a, b, policy);
    });

    for (const entry of remaining) {
      if (freed >= targetBytes) break;
      freed += entry.size;
      await this._cache!.delete(keyToUrl(entry.key));
    }

    return freed;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _assertInitialized(): void {
    if (!this._initialized || !this._cache) {
      throw new Error('[CacheBackend] Backend not initialized. Call initialize() first.');
    }
  }

  private _getTransaction(id: string): CacheTransaction {
    const tx = this._transactions.get(id);
    if (!tx) throw new Error(`[CacheBackend] No active transaction with id "${id}".`);
    return tx;
  }

  /**
   * Apply a committed batch of ops to the cache.
   * Called by {@link CacheTransaction.commit()}.
   */
  private async _commitTransaction(txId: string, ops: CacheBufferedOp[]): Promise<void> {
    if (ops.length === 0) {
      this._transactions.delete(txId);
      return;
    }

    for (const op of ops) {
      switch (op.kind) {
        case 'write':
          await this._cache!.put(keyToUrl(op.key), op.response);
          break;
        case 'delete':
          await this._cache!.delete(keyToUrl(op.key));
          break;
        case 'clear':
          if (!op.prefix) {
            await caches.delete(this._cacheName);
            this._cache = await caches.open(this._cacheName);
          } else {
            const reqs = await this._cache!.keys();
            for (const req of reqs) {
              const key = urlToKey(req.url);
              if (key && key.startsWith(op.prefix)) {
                await this._cache!.delete(req);
              }
            }
          }
          break;
      }
    }
    this._transactions.delete(txId);
  }

  private _defaultTieBreak(
    a: { key: CanonicalKey; envelope: StorageEnvelope<string> },
    b: { key: CanonicalKey; envelope: StorageEnvelope<string> },
    policy: EvictionPolicy,
  ): number {
    switch (policy) {
      case 'lru':
      case 'fifo':
        return a.envelope.written_at - b.envelope.written_at;
      case 'lfu':
        // CacheStorage does not track read frequency; fall back to written_at.
        return a.envelope.written_at - b.envelope.written_at;
      default:
        return 0;
    }
  }
}
