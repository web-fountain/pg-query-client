import 'server-only';

// AIDEV-NOTE: Redaction helpers for observability.
// Policy: never log SQL text, tokens, cookies, or Authorization headers.

export const REDACTED = '[redacted]';

const SENSITIVE_KEY_REGEX = /(authorization|cookie|set-cookie|token|jwt|secret|password|querytext)/i;

export function redactObject(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      out[key] = REDACTED;
      continue;
    }

    out[key] = value;
  }

  return out;
}

export function summarizeString(value: string, maxLen: number): { len: number; preview?: string } {
  const len = value.length;
  if (len <= maxLen) {
    return { len, preview: value };
  }
  return { len, preview: value.slice(0, maxLen) };
}
