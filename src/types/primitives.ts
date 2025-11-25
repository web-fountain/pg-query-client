// AIDEV-NOTE: Canonical home for ID primitives used across domains.
// AIDEV-NOTE: These are brand types only; enforce/validate invariants at module boundaries.


/*
 * ID primitives
 *
 * Base64Url22
 * - Derived from 16 random bytes (128 bits).
 * - Encode with standard base64, translate to base64url alphabet, and remove '=' padding.
 * - Math: base64 encodes 3 bytes → 4 chars. For 16 bytes: ceil(16/3) * 4 = 24 chars total.
 *   Since 16 % 3 = 1, standard base64 ends with '=='. Stripping '==' yields 22 characters.
 * - Invariants: length is exactly 22; alphabet is [A-Za-z0-9-_]; no padding.
 *
 */
export type Base64Url22 = string & { __brand: 'Base64Url22' };

/*
 * UUIDv7
 * - String form of UUID version 7 (time-ordered). Canonical format is 36 characters with hyphens.
 * - Shape: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx (variant bits 10xx in the 17th byte).
 *

 */
export type UUIDv7 = string & { __brand: 'UUIDv7' };

/*
 * Extension
 * - File extension type for data queries.
 * - Currently supports 'sql' for SQL query files.
 * - Used to determine syntax highlighting, validation, and execution context.
 */
export type Extension = 'sql';
