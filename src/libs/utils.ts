import type { ComputeClampParams } from "@/types";

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
  if (origin.length === 0) return true
  return new URL(import.meta.env.VITE_BASE_URL).origin === new URL(origin).origin
}
/**
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
/**
 * Estimates the memory footprint of a given value in bytes.
 * Handles Blobs, Files, Buffers, Strings, Numbers, Booleans, Dates, Arrays, Objects, and Null/Undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sizeOf(value: any): number {
  // 1. Primitive handling for null and undefined
  if (value === null || value === undefined) {
    return 0;
  }

  // 2. Handle structural and specialized object types
  if (typeof value === "object") {
    // Handle specialized Node.js Buffer
    // if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    //   return value.length;
    // }
    if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
      return value.byteLength;
    }

    // Handle browser Blob and File objects
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      return value.size;
    }

    // Handle Date objects (stored as an 8-byte 64-bit integer timestamp)
    if (value instanceof Date) {
      return 8;
    }

    // Handle Arrays (calculates the sum of all elements)
    if (Array.isArray(value)) {
      return value.reduce((acc, item) => acc + sizeOf(item), 0);
    }

    // Handle standard Objects (keys + values)
    let size = 0;
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        size += sizeOf(key);  // Key name takes up memory string space
        size += sizeOf(value[key]); // Value memory size
      }
    }
    return size;
  }

  // 3. Handle primitives
  switch (typeof value) {
    case "string":
      // Encoded in UTF-16 in JavaScript/TypeScript engines (2 bytes per character)
      return value.length * 2;

    case "number":
      // IEEE 754 double-precision floats take 8 bytes
      return 8;

    case "boolean":
      // Booleans are stored using 4 bytes (standard engine word size assignment)
      return 4;

    default:
      return 0;
  }
}

/**
 * Checks if the argument is null or undefined.
 *
 * @param x - The value to be checked.
 * @returns A type predicate asserting that the argument is null or undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNil(x: any): x is null | undefined {
  return x === null || x === undefined
}
/**
 * Checks if every element in an array/tuple is null or undefined.
 *
 * @param args - The items to be checked.
 * @returns A type predicate asserting that all elements in the input array are null or undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function allNil(...args: any[])/*: args is { [K in keyof T]: null | undefined }*/ {
  return args.every(isNil);
}
/**
 * Checks if any element in an array/tuple is null or undefined.
 *
 * @param args - The items to be checked.
 * @returns A type predicate asserting that at least 1 element in the input array is null or undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anyNil(...args: any[]) {
  return args.some(isNil);
}
/**
 * Checks if the argument is null.
 *
 * @param x - The value to be checked.
 * @returns A type predicate asserting that the argument is null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNull(x: any): x is null {
  return x === null
}
/**
 * Checks if every element in an array/tuple is null
 *
 * @param args - The items to be checked.
 * @returns A type predicate asserting that all elements in the input array are null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function allNull(...args: any[]) {
  return args.every(isNil);
}
/**
 * Checks if any element in an array/tuple is null
 *
 * @param args - The items to be checked.
 * @returns A type predicate asserting that at least 1 element in the input array is null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anyNull(...args: any[]) {
  return args.some(isNil);
}
/**
 * Checks if the argument is undefined.
 *
 * @param x - The value to be checked.
 * @returns A type predicate asserting that the argument is undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isUndefined(x: any): x is undefined {
  return x === undefined
}
/**
 * Checks if every element in an array/tuple is undefined.
 *
 * @param args - The items to be checked.
 * @returns A type predicate asserting that all elements in the input array are undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function allUndefined(...args: any[]) {
  return args.every(isNil);
}
/**
 * Checks if any element in an array/tuple is undefined.
 *
 * @param args - The items to be checked.
 * @returns A type predicate asserting that at least 1 element in the input array is undefined.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anyUndefined(...args: any[]) {
  return args.some(isNil);
}
