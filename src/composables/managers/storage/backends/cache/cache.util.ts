

// ─────────────────────────────────────────────────────────────────────────────
// URL mapping
// ─────────────────────────────────────────────────────────────────────────────

import type { CanonicalKey, StorageEnvelope } from "../../storage.types"
import { CACHE_URL_BASE, HDR_BACKEND, HDR_EXPIRES_AT, HDR_SCHEMA_VERSION, HDR_WEIGHT, HDR_WRITTEN_AT } from "./cache.const"

/**
 * Convert a canonical key to the fake internal URL used as the cache key.
 */
export function keyToUrl(key: CanonicalKey): string {
  return `${CACHE_URL_BASE}${encodeURIComponent(key)}`
}

/**
 * Recover the canonical key from the fake internal URL.
 * Returns `null` if the URL does not match the expected scheme.
 */
export function urlToKey(url: string): CanonicalKey | null {
  if (!url.startsWith(CACHE_URL_BASE)) return null
  return decodeURIComponent(url.slice(CACHE_URL_BASE.length)) as CanonicalKey
}

// ── Helper: build a Response from an envelope ─────────────────────────────

export function buildResponse(envelope: StorageEnvelope<string>): Response {
  const body = JSON.stringify(envelope);
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Content-Length', String(body.length));
  headers.set(HDR_SCHEMA_VERSION, String(envelope.schema_version));
  headers.set(HDR_WRITTEN_AT, String(envelope.written_at));
  headers.set(HDR_EXPIRES_AT, envelope.expires_at !== null ? String(envelope.expires_at) : '-1');
  headers.set(HDR_WEIGHT, String(envelope.weight));
  headers.set(HDR_BACKEND, envelope.backend);
  return new Response(body, { headers });
}

// ── Helper: extract envelope from a Response ──────────────────────────────

export async function extractEnvelope(response: Response): Promise<StorageEnvelope<string>> {
  const text = await response.text();
  return JSON.parse(text) as StorageEnvelope<string>;
}

// ── Helper: get expires_at from headers without reading body ──────────────

export function getExpiresAtFromHeaders(headers: Headers): number | null {
  const val = headers.get(HDR_EXPIRES_AT);
  if (val === '-1' || val === null) return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

// ── Helper: get byte length from headers ──────────────────────────────────

export function getContentLength(headers: Headers): number {
  const val = headers.get('Content-Length');
  return val ? Number(val) : 0;
}
