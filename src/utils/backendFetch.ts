'use server';

import { cache }                           from 'react';
import { headers }                         from 'next/headers';

import { getBackendAccessTokenOnBehalfOf } from '@Auth/obo';
import { formatError }                     from '@Utils/error';
import {
  createCorrelationId,
  getCorrelationInfoFromContext
}                                          from '@Observability/server';
import { logBackendCall }                  from '@Observability/server/http';


export type HeadersContext = {
  tenantPublicId    : string;
  opspacePublicId   : string;
  operatorPublicId  : string;
};

const DEFAULT_BACKEND_FETCH_TIMEOUT_MS  = 15000;
const DEFAULT_BACKEND_FETCH_SLOW_MS     = 1000;
const DEFAULT_ERROR_MESSAGE_MAX_LEN     = 500;
const DEFAULT_ACCEPT_HEADER             = 'application/json';
const DEFAULT_CONTENT_TYPE_HEADER       = 'application/json';
const DEBUG_ENABLED                     = (process.env.PGQC_LOG_LEVEL || '').toLowerCase() === 'debug';

// Log only high-signal backend call events by default:
// - errors (always)
// - slow calls (warn)
// Successes are emitted at debug level.
const BACKEND_FETCH_SLOW_MS = (() => {
  const raw = process.env.PGQC_BACKEND_FETCH_SLOW_MS || '';
  const ms  = Number(raw);
  if (Number.isFinite(ms) && ms > 0) {
    return ms;
  }
  return DEFAULT_BACKEND_FETCH_SLOW_MS;
})();


function truncateErrorMessage(message: string): string {
  if (message.length <= DEFAULT_ERROR_MESSAGE_MAX_LEN) return message;
  return message.slice(0, DEFAULT_ERROR_MESSAGE_MAX_LEN);
}

// Use a monotonic clock for durations (avoid wall-clock jumps).
function nowMs(): number {
  // `performance.now()` exists in Node (via perf_hooks) and in Edge-like runtimes.
  // Fall back to Date.now() defensively.
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

// Request-scoped memoization to avoid repeated `headers()` reads during
// bootstraps (multiple server actions called in one request).
const getHeadersContextCached = cache(async (): Promise<HeadersContext> => {
  const hdrs = await headers();
  return {
    tenantPublicId    : hdrs.get('x-tenant-id')   || '',
    opspacePublicId   : hdrs.get('x-opspace-id')  || '',
    operatorPublicId  : hdrs.get('x-operator-id') || ''
  };
});

// AIDEV-NOTE: Extract multitenancy context from request headers. Returns null if any are missing.
export async function getHeadersContextOrNull(): Promise<HeadersContext | null> {
  const ctx               = await getHeadersContextCached();
  const tenantPublicId    = ctx.tenantPublicId;
  const opspacePublicId   = ctx.opspacePublicId;
  const operatorPublicId  = ctx.operatorPublicId;

  if (!tenantPublicId || !opspacePublicId || !operatorPublicId) {
    console.error('[backendFetch] Missing required headers: x-tenant-id, x-opspace-id, x-operator-id');
    return null;
  }

  // AIDEV-NOTE: Return a new object so consumers can't accidentally mutate the cached value.
  return { tenantPublicId, opspacePublicId, operatorPublicId };
}

type BackendFetchOptions = {
  path          : string;
  method?       : 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  scope         : string[];
  body?         : unknown;
  tags?         : string[];
  logLabel?     : string;
  context?      : HeadersContext;
  contentType?  : 'application/json' | null;
  accept?       : 'application/json';
  audience?     : string;
  timeoutMs?    : number;
};

type BackendFetchJSONResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: unknown;
  context?: HeadersContext;
};

function buildScopeKey(scope: string[]): string {
  // AIDEV-NOTE: `scope` is required by BackendFetchOptions, but keep this guard
  // to avoid unexpected runtime errors.
  if (!Array.isArray(scope) || scope.length === 0) {
    return '';
  }

  // Fast path: common call sites pass stable, already-sorted unique scope lists.
  if (scope.length === 1) {
    return scope[0] || '';
  }

  let prev = scope[0] || '';
  for (let i = 1; i < scope.length; i++) {
    const cur = scope[i] || '';
    if (cur <= prev) {
      const uniq = Array.from(new Set(scope));
      uniq.sort();
      return uniq.join(' ');
    }
    prev = cur;
  }

  return scope.join(' ');
}

// AIDEV-NOTE: Memoize OBO token per request to avoid repeated minting during bootstraps
// (e.g. Promise.all([...]) calling backendFetchJSON multiple times).
const getBackendJwtForRequest = cache(async (
  tenantPublicId: string,
  opspacePublicId: string,
  operatorPublicId: string,
  audience: string,
  scopeKey: string
): Promise<string> => {
  const scope = scopeKey ? scopeKey.split(' ') : undefined;
  return getBackendAccessTokenOnBehalfOf({
    audience,
    scope,
    headersContext: { tenantPublicId, opspacePublicId, operatorPublicId }
  });
});

// AIDEV-NOTE: Server-side JSON fetch helper. Performs OBO, sets JSON headers, applies Next.js tags, parses JSON.
export async function backendFetchJSON<T>(opts: BackendFetchOptions): Promise<BackendFetchJSONResult<T>> {
  const {
    path, scope, body, tags, context,
    method      = 'GET',
    logLabel    = 'backendFetch',
    contentType = DEFAULT_CONTENT_TYPE_HEADER,
    accept      = DEFAULT_ACCEPT_HEADER,
    audience    = 'pg-query-client-mcp',
    timeoutMs   = DEFAULT_BACKEND_FETCH_TIMEOUT_MS
  } = opts;

  const ctx = context ?? await getHeadersContextOrNull();
  if (!ctx) {
    return { ok: false, status: 400, error: 'missing-context' };
  }

  const correlation = getCorrelationInfoFromContext() ?? { correlationId: createCorrelationId() };

  const scopeKey = buildScopeKey(scope);
  const backendJwt = await getBackendJwtForRequest(
    ctx.tenantPublicId,
    ctx.opspacePublicId,
    ctx.operatorPublicId,
    audience,
    scopeKey
  );

  const urlBase = process.env.PGQC_SERVER_URL || '';
  const url = path[0] === '/' ? (urlBase + path) : (urlBase + '/' + path);

  const hasAuth = backendJwt !== '';
  const hasContentType = contentType !== null;

  const requestHeaders: Record<string, string> = {
    'accept': accept,
    'x-correlation-id': correlation.correlationId
  };

  if (hasAuth) {
    requestHeaders['authorization'] = `Bearer ${backendJwt}`;
  }

  if (hasContentType) {
    requestHeaders['content-type'] = contentType as 'application/json';
  }

  const init: RequestInit & { next?: { tags?: string[] } } = {
    method,
    headers: requestHeaders
  };

  if (typeof body !== 'undefined') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (tags && tags.length > 0) {
    init.next = { tags };
  }

  const controller = timeoutMs > 0 ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (controller) {
    init.signal = controller.signal;
    timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  const fetchStart = nowMs();
  try {
    const res = await fetch(url, init);
    const durationMs = Math.round(nowMs() - fetchStart);
    if (!res.ok) {
      let errBody: unknown = null;
      try { errBody = await res.json(); } catch { try { errBody = await res.text(); } catch {} }
      logBackendCall('error', {
        event         : 'backendFetch',
        label         : logLabel,
        method        : method,
        url           : url,
        status        : res.status,
        durationMs    : durationMs,
        ctx           : ctx,
        correlationId : correlation.correlationId,
        vercelId      : correlation.vercelId,
        errorCode     : 'backend-non-2xx',
        errorMessage  : DEBUG_ENABLED ? truncateErrorMessage(formatError(errBody)) : undefined
      });
      return { ok: false, status: res.status, error: errBody, context: ctx };
    }

    if (res.status === 204) {
      logBackendCall(durationMs >= BACKEND_FETCH_SLOW_MS ? 'warn' : 'debug', {
        event         : 'backendFetch',
        label         : logLabel,
        method        : method,
        url           : url,
        status        : res.status,
        durationMs    : durationMs,
        ctx           : ctx,
        correlationId : correlation.correlationId,
        vercelId      : correlation.vercelId
      });
      return { ok: true, status: res.status, data: {} as T, context: ctx };
    }

    let responsePayload: T;
    try {
      responsePayload = await res.json();
    } catch (jsonError) {
      logBackendCall('error', {
        event         : 'backendFetch',
        label         : logLabel,
        method        : method,
        url           : url,
        status        : res.status,
        durationMs    : durationMs,
        ctx           : ctx,
        correlationId : correlation.correlationId,
        vercelId      : correlation.vercelId,
        errorCode     : 'backend-parse',
        errorMessage  : DEBUG_ENABLED ? truncateErrorMessage(formatError(jsonError)) : undefined
      });
      return { ok: false, status: res.status, error: formatError(jsonError), context: ctx };
    }

    logBackendCall(durationMs >= BACKEND_FETCH_SLOW_MS ? 'warn' : 'debug', {
      event         : 'backendFetch',
      label         : logLabel,
      method        : method,
      url           : url,
      status        : res.status,
      durationMs    : durationMs,
      ctx           : ctx,
      correlationId : correlation.correlationId,
      vercelId      : correlation.vercelId
    });
    return { ok: true, status: res.status, data: responsePayload, context: ctx };
  } catch (error) {
    const durationMs = Math.round(nowMs() - fetchStart);
    if ((error as any)?.name === 'AbortError') {
      logBackendCall('error', {
        event         : 'backendFetch',
        label         : logLabel,
        method        : method,
        url           : url,
        status        : 408,
        durationMs    : durationMs,
        ctx           : ctx,
        correlationId : correlation.correlationId,
        vercelId      : correlation.vercelId,
        errorCode     : 'backend-timeout',
        errorMessage  : `request timed out after ${timeoutMs}ms`
      });
      return { ok: false, status: 408, error: 'timeout', context: ctx };
    }
    logBackendCall('error', {
      event         : 'backendFetch',
      label         : logLabel,
      method        : method,
      url           : url,
      status        : 0,
      durationMs    : durationMs,
      ctx           : ctx,
      correlationId : correlation.correlationId,
      vercelId      : correlation.vercelId,
      errorCode     : 'backend-network',
      errorMessage  : DEBUG_ENABLED ? truncateErrorMessage(formatError(error)) : undefined
    });
    return { ok: false, status: 0, error, context: ctx };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
