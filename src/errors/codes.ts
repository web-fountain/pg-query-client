// Stable, additive-only error code registry for the UI app.
// Treat codes as a public API: never rename/reuse a code for a different meaning.
//
// Design goals:
// - Small cross-cutting set (use `meta.action` to answer "where" and `code` to answer "what class")
// - Serializable across server actions and Redux
// - Compatible with observability logs (see `src/observability/server/CONTEXT.md`)

type ValueOf<T> = T[keyof T];

export const ERROR_CODES = {
  context: {
    missingContext  : 'missing-context'
  },
  auth: {
    unauthenticated : 'unauthenticated',
    forbidden       : 'forbidden'
  },
  input: {
    invalidInput    : 'invalid-input'
  },
  resource: {
    notFound        : 'not-found',
    conflict        : 'conflict'
  },
  rateLimit: {
    rateLimited     : 'rate-limited'
  },
  backend: {
    non2xx          : 'backend-non-2xx',
    failed          : 'backend-failed',
    timeout         : 'backend-timeout',
    parse           : 'backend-parse',
    network         : 'backend-network'
  },
  unexpected: {
    unexpected      : 'unexpected'
  }
} as const;

// Extract union of all nested code string literals.
// `keyof (A | B)` becomes the intersection of keys (often `never`), so avoid `ValueOf<ValueOf<...>>`.
export type ErrorCode = {
  [K in keyof typeof ERROR_CODES]: ValueOf<(typeof ERROR_CODES)[K]>
}[keyof typeof ERROR_CODES];

export const DEFAULT_ERROR_MESSAGE_BY_CODE: Record<ErrorCode, string> = {
  [ERROR_CODES.context.missingContext] : 'Missing required workspace context.',
  [ERROR_CODES.auth.unauthenticated]   : 'You are not signed in.',
  [ERROR_CODES.auth.forbidden]         : 'You do not have permission to perform this action.',
  [ERROR_CODES.input.invalidInput]     : 'Some fields are invalid.',
  [ERROR_CODES.resource.notFound]      : 'The requested resource was not found.',
  [ERROR_CODES.resource.conflict]      : 'The request could not be completed due to a conflict.',
  [ERROR_CODES.rateLimit.rateLimited]  : 'Too many requests. Please try again shortly.',
  [ERROR_CODES.backend.non2xx]         : 'The server returned an error response.',
  [ERROR_CODES.backend.failed]         : 'The server was unable to complete the request.',
  [ERROR_CODES.backend.timeout]        : 'The request timed out. Please try again.',
  [ERROR_CODES.backend.parse]          : 'The server returned an invalid response.',
  [ERROR_CODES.backend.network]        : 'A network error occurred. Please try again.',
  [ERROR_CODES.unexpected.unexpected]  : 'An unexpected error occurred.'
};

export function isRetryableCode(code: ErrorCode, status?: number): boolean {
  if (code === ERROR_CODES.backend.timeout)       return true;
  if (code === ERROR_CODES.backend.network)       return true;
  if (code === ERROR_CODES.rateLimit.rateLimited) return true;

  // Retry only on typical transient upstream errors.
  if (code === ERROR_CODES.backend.non2xx) {
    return status === 502 || status === 503 || status === 504;
  }

  return false;
}
