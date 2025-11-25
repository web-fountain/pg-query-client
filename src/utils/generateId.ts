/*
 * ID generation utilities
 *
 * Provides:
 * - Base64Url22: 16 random bytes → 22-char base64url (unpadded) string.
 * - UUIDv7: RFC 9562 time-ordered UUID v7 (canonical 36-char string).
 *
 * Cross-runtime:
 * - Uses Web Crypto for randomness (browser + Node 18+/24+ via global crypto).
 * - Conservative Node fallback when global crypto is missing.
 *
 * Validation:
 * - Regexes enforce shape invariants only (not timestamp semantics).
 *
 * AIDEV-NOTE: Keep generation centralized so call sites stay decoupled from implementation details/packages.
 * AIDEV-TODO: Add a monotonic v7 variant if strict per-process ordering is ever required.
 */
import type { Base64Url22, UUIDv7 } from '@Types/primitives';
import { v7 as uuidv7 }             from 'uuid';


// A 22-char URL-safe base64 regex (A–Z, a–z, 0–9, -, _). Exact length 22.
const Base64Url22_REGEX = /^[A-Za-z0-9\-_]{22}$/;

// Cross-platform crypto (browser + Node via webcrypto)
function getWebCrypto(): Crypto {
  // Prefer Web Crypto if available (needs getRandomValues only)
  const wc: Crypto | undefined =
    typeof (globalThis as any).crypto !== 'undefined' &&
    typeof (globalThis as any).crypto.getRandomValues === 'function'
      ? (globalThis as any).crypto
      : undefined;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // @ts-ignore - Node exposes webcrypto via require('crypto').webcrypto
  return wc || require('crypto').webcrypto as Crypto;
}

// Encode bytes to base64 (then convert to base64url). Prefers btoa in browsers; Buffer fallback for Node.
function bytesToBase64(bytes: Uint8Array): string {
  // Browser path
  if (typeof (globalThis as any).btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return (globalThis as any).btoa(binary);
  }
  // Node path (Buffer is globally available in Node runtimes)
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(bytes).toString('base64');
  }
  // Fallback (very unlikely): manual base64 via TextDecoder + btoa polyfill
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // @ts-ignore
  return (globalThis as any).btoa?.(binary) || '';
}

function toBase64UrlNoPad(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

// Generate a 22-char base64url ID from 16 random bytes.
export function generateBase64Url22(): Base64Url22 {
  const crypto = getWebCrypto();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const b64 = bytesToBase64(bytes);
  return toBase64UrlNoPad(b64) as Base64Url22;
}

// Validate a 22-char base64url ID.
export function isBase64Url22(value: unknown): value is Base64Url22 {
  return typeof value === 'string' && Base64Url22_REGEX.test(value);
}

// Canonical v7 shape w/ version nibble '7' and RFC 4122 variant '10xx'.
const UUIDv7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateUUIDv7(): UUIDv7 {
  // Thin wrapper to centralize generation; keeps call sites decoupled from lib choice.
  return uuidv7() as UUIDv7;
}

export function isUUIDv7(value: unknown): value is UUIDv7 {
  // Validates canonical shape only; does not validate embedded timestamp semantics.
  return typeof value === 'string' && UUIDv7_REGEX.test(value);
}
