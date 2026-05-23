import type { ComputeClampParams } from "@/types/utils.type";
import { isNil } from "lodash";

/**
 * Generates a cryptographically secure random floating-point number
 * between 0 (inclusive) and 1 (exclusive), similar to Math.random().
 */
export function generateSecureRandom(): number {
  // Use Uint32Array for better precision than Uint8Array when scaling to a large range.
  const randomUint32Values = new Uint32Array(1);

  // Fills the array with cryptographically secure random values.
  // The 'crypto' object is available globally in browsers and Node.js (via require('crypto') in older versions, global in newer).
  crypto.getRandomValues(randomUint32Values);

  const u32Max = 0xffffffff; // Maximum value for a 32-bit unsigned integer (4294967295)
  // To ensure the result is strictly less than 1, divide by max + 1 (4294967296).
  const result = randomUint32Values[0] / (u32Max + 1);

  return result;
}
/**
 * Clamps a number between a minimum and maximum value. If
 * the value is less than the minimum, the minimum is
 * returned. If the value is greater than the maximum,
 * the maximum is returned. Otherwise, the value itself
 * is returned.
 * @param param0 the arguments as named parameters
 * @returns returns the clamped value (i.e., the value constrained to be within
 * the min and max bounds)
 */
export function computeClamp({
  max = Number.MAX_SAFE_INTEGER,
  min = Number.MIN_SAFE_INTEGER,
  value = 0,
}: ComputeClampParams) {
  return Math.min(max, Math.max(min, value));
}
export function clientIsSameOriginWithWorker(origin: string) {
    if(origin.length === 0) return true
    return new URL(import.meta.env.VITE_BASE_URL).origin === new URL(origin).origin
}/**
 * Generates a consistent 32-bit integer hash from a string.
 * @param {string} str - The input string to hash.
 * @returns {number} A numeric hash value.
 */
export function stringToHash(str?: string | null): number {
  let hash = 0;

  if (isNil(str) || str.length === 0) return hash;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // (hash << 5) - hash is effectively: hash * 31
    // Bitwise OR 0 converts the result to a signed 32-bit integer
    hash = ((hash << 5) - hash + char) | 0;
  }

  return hash;
}
