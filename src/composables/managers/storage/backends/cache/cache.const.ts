/**
 * Base URL used to fabricate `Request` objects for `CacheStorage`.
 *
 * @remarks
 * CacheStorage is keyed by HTTP request URLs. Rather than using real network
 * addresses, we construct fake internal URLs that will never conflict with
 * actual fetches. The canonical key is appended as the URL pathname.
 *
 * Example:
 * ```
 * "myapp:chrome:130:auth:session"
 *   →  "https://storage.internal/myapp:chrome:130:auth:session"
 * ```
 *
 * The `:` characters are legal in URL paths, so no percent-encoding is
 * needed for the canonical key segments themselves.
 */
export const CACHE_URL_BASE = 'https://storage.internal/'

// ─────────────────────────────────────────────────────────────────────────────
// Custom response header names
// ─────────────────────────────────────────────────────────────────────────────

/** Monotonically increasing schema version — mirrors `StorageEnvelope.schema_version`. */
export const HDR_SCHEMA_VERSION = 'x-storage-schema-version'
/** Unix ms write timestamp — mirrors `StorageEnvelope.written_at`. */
export const HDR_WRITTEN_AT     = 'x-storage-written-at'
/**
 * Unix ms expiry timestamp. The sentinel value `'-1'` means no expiry
 * (mirrors `StorageEnvelope.expires_at === null`).
 */
export const HDR_EXPIRES_AT     = 'x-storage-expires-at'
/** User-defined eviction weight — mirrors `StorageEnvelope.weight`. */
export const HDR_WEIGHT         = 'x-storage-weight'
/** The {@link BackendKind} string — always `'cache'` for this backend. */
export const HDR_BACKEND        = 'x-storage-backend'
