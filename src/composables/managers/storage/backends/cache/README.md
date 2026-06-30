# CacheStorage Backend

**Location:** `src/composables/managers/storage/backends/cache`

The **CacheStorage** backend implements `IStorageBackend<string>` using the browser's `CacheStorage` API (`caches`). It stores each entry as an HTTP `Response` inside a named `Cache`, with the `StorageEnvelope` serialised as JSON in the response body and critical metadata (expiry, weight, schema version) mirrored in custom headers.

---

## Files

| File | Purpose |
|---|---|
| `cache.const.ts` | Base URL and header name constants. |
| `cache.types.ts` | Types: `CacheBackendConfig`, `CacheBufferedOp`, `ICacheTransaction`. |
| `cache.util.ts` | `keyToUrl` / `urlToKey` mapping functions. |
| `cache.transaction.ts` | `CacheTransaction` – best‑effort buffered transaction. |
| `cache.backend.ts` | `CacheBackend` – main backend class. |
| `index.ts` | Barrel export. |

---

## Architecture

```
CALLER
  ||  storage.set / storage.get / storage.transaction
  \/
PIPELINE (not in this module)
  ||  validates, serialises, encrypts, attaches envelope
  \/
CacheBackend
  |
  +-> NON‑TRANSACTIONAL
  |     write()   -> build Response -> cache.put(url, response)
  |     read()    -> cache.match(url) -> check expiry (headers) -> read body
  |     delete()  -> cache.delete(url)
  |     clear()   -> if no prefix: caches.delete(name) & re‑open
  |                  else: iterate keys, delete matching prefix
  |     query()   -> cache.keys() -> filter by prefix & schema_version (headers)
  |                  -> read body only for matches
  |     evict()   -> Phase 1: delete expired; Phase 2: sort by weight & policy
  |
  +-> TRANSACTIONAL
        beginTransaction() -> new CacheTransaction(_commit, _rollback)
                             stored in _transactions[id]
        write/delete/clear with { transactionId }
          -> tx.bufferWrite / bufferDelete / bufferClear
          -> ops[] grows, cache untouched
        tx.commit()
          -> _onCommit(txId, ops) -> apply ops sequentially to cache
          -> _transactions.delete(txId)
        tx.rollback()
          -> (no arg): ops = [], settle, deregister
          -> (partial): remove matching ops, keep open
```

---

## Why store metadata in headers?

`Cache.keys()` returns only `Request` objects. To know **anything** about an entry – its expiry, weight, or schema version – you would normally have to call `Cache.match()` and read the entire response body. By storing these fields as custom HTTP headers:

- TTL checks (`read`, `query`) happen without deserialising the body.
- Schema‑version filtering (`query`) is fast.
- Eviction sorting can use header data only (no body reads).

Body reads are deferred until the envelope payload is explicitly needed (`read()` or full `query()`).

---

## Transaction strength: `best‑effort`

CacheStorage has no native multi‑op atomicity. `CacheTransaction` buffers ops in memory and applies them sequentially on `commit()`. A crash between two `cache.put()` calls leaves the cache partially updated. Rollback is free because nothing was written yet.

| Strength | Guarantee |
|---|---|
| `best‑effort` | Atomicity only within the same JavaScript turn; no durability or isolation. |

`beginTransaction()` rejects any other strength.

---

## Key design decisions

### `TRaw = string`

`CacheBackend` stores `StorageEnvelope<string>`. The payload is already serialised and encrypted by the pipeline – the backend simply JSON‑stringifies the whole envelope and stores it as the response body.

### No persistent connection

`caches.open()` is called once in `initialize()` and the `Cache` object is kept for the lifetime of the backend. `close()` releases the reference but does **not** delete any stored data.

### Eviction lacks LFU

CacheStorage does not provide read‑count tracking. The `lfu` policy falls back to `written_at` (oldest first). If you need true LFU, consider using Memory or OPFS.

### `clear()` with no prefix

Deletes the entire named cache (`caches.delete(name)`) and re‑opens it. This is the fastest way to clear all data.

---

## Usage example

```ts
import { CacheBackend } from './backends/cache'

const backend = new CacheBackend({ cacheName: 'app-storage' })

// Probe & initialise
const probe = await backend.probe()
if (probe.available) {
  await backend.initialize()
}

// Direct write/read
const key = 'myapp:chrome:130:auth:session' as CanonicalKey
await backend.write(key, {
  payload:        'AES-GCM-ENCRYPTED-STRING',
  schema_version: 1,
  written_at:     Date.now(),
  expires_at:     Date.now() + 3600000,
  weight:         5,
  backend:        'cache',
})

const envelope = await backend.read(key)

// Transactional batch
const tx = await backend.beginTransaction()
await backend.write(keyA, envA, { transactionId: tx.id })
await backend.delete(keyB,          { transactionId: tx.id })
await tx.commit()   // both applied, or

await tx.rollback() // buffer discarded
```

---

## Lifecycle

```
new CacheBackend(config)
  |
  +-> config.cacheName (default: 'storage')

probe()
  -> opens cache, writes/reads/deletes a test entry
  -> { available: true, latency: Nms } or { available: false, reason }

initialize(signal?)
  -> caches.open(cacheName) -> _cache
  -> _initialized = true

close()
  -> rollback all pending transactions
  -> _cache = null, _initialized = false
  (data remains in CacheStorage)
```

---

## What this module does NOT do

- **Encrypt or serialise** – payloads are already encrypted strings when they arrive.
- **Provide serializable transactions** – only `best‑effort`.
- **Track read frequency** – LFU eviction falls back to `written_at`.
- **Persist across service worker updates** – the cache is scoped to the origin and survives page reloads, but it is not versioned by default (use a versioned `cacheName`).