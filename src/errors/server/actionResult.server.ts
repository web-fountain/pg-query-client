import 'server-only';

import type { FieldError }      from '../fieldError';
import type { ErrorCode }       from '../codes';
import type {
  ActionError, ActionErrorKind,
  ActionMeta, ActionResult
}                               from '../types';

import { formatError }          from '@Utils/error';
import { generateBase64Url22 }  from '@Utils/generateId';
import {
  DEFAULT_ERROR_MESSAGE_BY_CODE,
  ERROR_CODES, isRetryableCode
}                               from '../codes';


type BackendRequestDebug = {
  path      : string;
  method    : string;
  scope     : string[];
  logLabel? : string;
};

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function makeActionMeta(action: string): ActionMeta {
  return {
    action    : action,
    requestId : generateBase64Url22(),
    at        : Date.now()
  };
}

export function ok<T>(meta: ActionMeta, data: T): ActionResult<T> {
  return { success: true, data, meta };
}

export function fail<T>(meta: ActionMeta, error: ActionError): ActionResult<T> {
  return { success: false, error, meta };
}

export function missingContextActionError(meta: ActionMeta): ActionError {
  const code = ERROR_CODES.context.missingContext;
  return {
    id        : meta.requestId,
    kind      : 'context',
    code      : code,
    message   : DEFAULT_ERROR_MESSAGE_BY_CODE[code],
    status    : 400,
    retryable : false
  };
}

function extractFieldErrors(raw: unknown): FieldError[] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const obj = raw as Record<string, unknown>;
  const list =
    Array.isArray(obj['fields']) ? obj['fields']
    : Array.isArray(obj['errors']) ? obj['errors']
    : null;

  if (!list) return undefined;

  const out: FieldError[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const path = typeof it['path'] === 'string' ? it['path'] : '';
    const message =
      typeof it['message'] === 'string' ? it['message']
      : typeof it['error'] === 'string' ? it['error']
      : '';

    if (!path && !message) continue;
    out.push({ path, message: message || 'Invalid value' });
  }

  return out.length > 0 ? out : undefined;
}

function kindFromCode(code: ErrorCode): ActionErrorKind {
  switch (code) {
    case ERROR_CODES.context.missingContext:
      return 'context';
    case ERROR_CODES.auth.unauthenticated:
    case ERROR_CODES.auth.forbidden:
      return 'auth';
    case ERROR_CODES.input.invalidInput:
      return 'validation';
    case ERROR_CODES.resource.notFound:
    case ERROR_CODES.resource.conflict:
      return 'resource';
    case ERROR_CODES.rateLimit.rateLimited:
      return 'rate-limit';
    case ERROR_CODES.backend.timeout:
    case ERROR_CODES.backend.parse:
    case ERROR_CODES.backend.non2xx:
    case ERROR_CODES.backend.failed:
      return 'backend';
    case ERROR_CODES.backend.network:
      return 'network';
    case ERROR_CODES.unexpected.unexpected:
      return 'unexpected';
    default: {
      // AIDEV-NOTE: Exhaustiveness guard. If you add a new ErrorCode, update this mapping.
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

function codeFromBackendFailure(status: number, rawError: unknown): ErrorCode {
  if (status === 400 && rawError === 'missing-context') return ERROR_CODES.context.missingContext;

  if (status === 401) return ERROR_CODES.auth.unauthenticated;
  if (status === 403) return ERROR_CODES.auth.forbidden;
  if (status === 404) return ERROR_CODES.resource.notFound;
  if (status === 409) return ERROR_CODES.resource.conflict;
  if (status === 422) return ERROR_CODES.input.invalidInput;
  if (status === 429) return ERROR_CODES.rateLimit.rateLimited;

  if (status === 408 || rawError === 'timeout') return ERROR_CODES.backend.timeout;
  if (status === 0) return ERROR_CODES.backend.network;

  return ERROR_CODES.backend.non2xx;
}

export function backendFailedActionError(meta: ActionMeta, args?: {
  message?: string;
  request?: BackendRequestDebug;
}): ActionError {
  const code = ERROR_CODES.backend.failed;
  const message = args?.message || DEFAULT_ERROR_MESSAGE_BY_CODE[code];
  const debug = isDev()
    ? {
        backend: args?.request
      }
    : undefined;

  return {
    id        : meta.requestId,
    kind      : kindFromCode(code),
    code      : code,
    message   : message,
    retryable : isRetryableCode(code),
    debug     : debug
  };
}

export function actionErrorFromBackendFetch(meta: ActionMeta, args: {
  status: number;
  error?: unknown;
  request?: BackendRequestDebug;
  fallbackMessage?: string;
  // Set when the backend returned 2xx but we failed to parse JSON.
  isParseFailure?: boolean;
}): ActionError {
  const { status, error, request, fallbackMessage, isParseFailure } = args;

  // backendFetchJSON returns `ok: false` for JSON parse failures even when the HTTP
  // status is 2xx. Infer parse failures automatically unless a caller explicitly overrides.
  const inferredParseFailure =
    isParseFailure === true ||
    (typeof isParseFailure === 'undefined' && status >= 200 && status < 300);

  const code: ErrorCode =
    inferredParseFailure ? ERROR_CODES.backend.parse : codeFromBackendFailure(status, error);

  const kind = kindFromCode(code);
  const fields = code === ERROR_CODES.input.invalidInput ? extractFieldErrors(error) : undefined;

  const message =
    fallbackMessage ||
    DEFAULT_ERROR_MESSAGE_BY_CODE[code] ||
    'Request failed';

  const debug = isDev()
    ? {
        cause: formatError(error),
        backend: request ? { ...request, status } : { status }
      }
    : undefined;

  return {
    id: meta.requestId,
    kind,
    code,
    message,
    status,
    retryable: isRetryableCode(code, status),
    fields,
    debug
  };
}

export function unexpectedActionError(meta: ActionMeta, err: unknown): ActionError {
  const code = ERROR_CODES.unexpected.unexpected;
  return {
    id        : meta.requestId,
    kind      : 'unexpected',
    code      : code,
    message   : DEFAULT_ERROR_MESSAGE_BY_CODE[code],
    retryable : false,
    debug     : isDev() ? { cause: formatError(err) } : undefined
  };
}

export function aggregateActionError(meta: ActionMeta, args: {
  code      : ErrorCode;
  message?  : string;
  status?   : number;
  causes    : ActionError[];
}): ActionError {
  const { code, causes } = args;
  const message          = args.message || DEFAULT_ERROR_MESSAGE_BY_CODE[code];
  const kind             = kindFromCode(code);

  return {
    id        : meta.requestId,
    kind      : kind,
    code      : code,
    message   : message,
    status    : args.status,
    retryable : causes.some(c => c.retryable),
    causes  : causes.map(c => ({
      action  : c.debug?.backend?.path ? c.debug.backend.path : 'unknown',
      id      : c.id,
      kind    : c.kind,
      code    : c.code,
      message : c.message
    }))
  };
}
