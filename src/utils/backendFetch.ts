'use server';

import { cache }                            from 'react';
import { headers }                          from 'next/headers';
import { getBackendAccessTokenOnBehalfOf }  from '@Auth/obo';
import { formatError }                      from '@Utils/error';


export type HeadersContext = {
  tenantPublicId    : string;
  opspacePublicId   : string;
  operatorPublicId  : string;
};

const DEFAULT_BACKEND_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_ACCEPT_HEADER = 'application/json';
const DEFAULT_CONTENT_TYPE_HEADER = 'application/json';

// AIDEV-NOTE: Precomputed log header payloads (avoid per-call JSON.stringify on a hot path).
const LOG_HEADERS_NO_AUTH_NO_CT = JSON.stringify({
  'accept': DEFAULT_ACCEPT_HEADER
});
const LOG_HEADERS_NO_AUTH_CT = JSON.stringify({
  'accept': DEFAULT_ACCEPT_HEADER,
  'content-type': DEFAULT_CONTENT_TYPE_HEADER
});
const LOG_HEADERS_AUTH_NO_CT = JSON.stringify({
  'accept': DEFAULT_ACCEPT_HEADER,
  'authorization': '[redacted]'
});
const LOG_HEADERS_AUTH_CT = JSON.stringify({
  'accept': DEFAULT_ACCEPT_HEADER,
  'authorization': '[redacted]',
  'content-type': DEFAULT_CONTENT_TYPE_HEADER
});

// AIDEV-NOTE: Request-scoped memoization to avoid repeated `headers()` reads during
// bootstraps (multiple server actions called in one request).
const getHeadersContextCached = cache(async (): Promise<HeadersContext> => {
  const hdrs = await headers();
  return {
    tenantPublicId: hdrs.get('x-tenant-id') || '',
    opspacePublicId: hdrs.get('x-opspace-id') || '',
    operatorPublicId: hdrs.get('x-operator-id') || ''
  };
});

// AIDEV-NOTE: Extract multitenancy context from request headers. Returns null if any are missing.
export async function getHeadersContextOrNull(): Promise<HeadersContext | null> {
  const ctx = await getHeadersContextCached();
  const tenantPublicId = ctx.tenantPublicId;
  const opspacePublicId = ctx.opspacePublicId;
  const operatorPublicId = ctx.operatorPublicId;

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
    contentType = 'application/json',
    accept      = 'application/json',
    audience    = 'pg-query-client-mcp',
    timeoutMs   = DEFAULT_BACKEND_FETCH_TIMEOUT_MS
  } = opts;

  const ctx = context ?? await getHeadersContextOrNull();
  if (!ctx) {
    return { ok: false, status: 400, error: 'missing-context' };
  }

  const scopeKey = buildScopeKey(scope);
  const backendJwt = await getBackendJwtForRequest(
    ctx.tenantPublicId,
    ctx.opspacePublicId,
    ctx.operatorPublicId,
    audience,
    scopeKey
  );

  const urlBase = process.env.PG_QUERY_CLIENT_SERVER_URL || '';
  const url = path[0] === '/' ? (urlBase + path) : (urlBase + '/' + path);

  const hasAuth = backendJwt !== '';
  const hasContentType = contentType !== null;

  let requestHeaders: Record<string, string>;
  let loggedHeadersJson: string;
  if (hasAuth) {
    const authHeader = `Bearer ${backendJwt}`;
    if (hasContentType) {
      requestHeaders = {
        'accept': accept,
        'authorization': authHeader,
        'content-type': contentType as 'application/json'
      };
      loggedHeadersJson = LOG_HEADERS_AUTH_CT;
    } else {
      requestHeaders = {
        'accept': accept,
        'authorization': authHeader
      };
      loggedHeadersJson = LOG_HEADERS_AUTH_NO_CT;
    }
  } else {
    if (hasContentType) {
      requestHeaders = {
        'accept': accept,
        'content-type': contentType as 'application/json'
      };
      loggedHeadersJson = LOG_HEADERS_NO_AUTH_CT;
    } else {
      requestHeaders = {
        'accept': accept
      };
      loggedHeadersJson = LOG_HEADERS_NO_AUTH_NO_CT;
    }
  }

  const init: RequestInit & { next?: { tags?: string[] } } = {
    method,
    headers: requestHeaders
  };

  let bodyForLog = '';
  if (typeof body !== 'undefined') {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    init.body = bodyString;
    bodyForLog = bodyString ? bodyString : '';
  }

  if (tags && tags.length > 0) {
    init.next = { tags };
  }

  console.log(
    `[${logLabel}] ${method}`,
    url,
    'headers:',
    loggedHeadersJson,
    'body: ' + bodyForLog
  );

  const controller = timeoutMs > 0 ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (controller) {
    init.signal = controller.signal;
    timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      let errBody: unknown = null;
      try { errBody = await res.json(); } catch { try { errBody = await res.text(); } catch {} }
      console.error(`[${logLabel}] request failed`, res.status, '-', formatError(errBody));
      return { ok: false, status: res.status, error: errBody, context: ctx };
    }

    if (res.status === 204) {
      return { ok: true, status: res.status, data: {} as T, context: ctx };
    }

    let responsePayload: T;
    try {
      responsePayload = await res.json();
      // console.log('[backendFetchJSON] responsePayload', responsePayload);
    } catch (jsonError) {
      console.error(`[${logLabel}] failed to parse JSON response`, formatError(jsonError));
      return { ok: false, status: res.status, error: formatError(jsonError), context: ctx };
    }

    return { ok: true, status: res.status, data: responsePayload, context: ctx };
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      console.error(`[${logLabel}] request timed out after ${timeoutMs}ms`, url);
      return { ok: false, status: 408, error: 'timeout', context: ctx };
    }
    console.error(`[${logLabel}] network error`, formatError(error));
    return { ok: false, status: 0, error, context: ctx };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
