'use server';

import { headers }                          from 'next/headers';
import { getBackendAccessTokenOnBehalfOf }  from '@Auth/obo';
import { formatError }                      from '@Utils/error';


export type HeadersContext = {
  tenantPublicId    : string;
  opspacePublicId   : string;
  operatorPublicId  : string;
};

// AIDEV-NOTE: Extract multitenancy context from request headers. Returns null if any are missing.
export async function getHeadersContextOrNull(): Promise<HeadersContext | null> {
  const hdrs = await headers();
  const tenantPublicId    = hdrs.get('x-tenant-id')   || '';
  const opspacePublicId   = hdrs.get('x-opspace-id')  || '';
  const operatorPublicId  = hdrs.get('x-operator-id') || '';

  if (!tenantPublicId || !opspacePublicId || !operatorPublicId) {
    console.error('[backendFetch] Missing required headers: x-tenant-id, x-opspace-id, x-operator-id');
    return null;
  }

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
};

type BackendFetchJSONResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: unknown;
  context?: HeadersContext;
};

// AIDEV-NOTE: Server-side JSON fetch helper. Performs OBO, sets JSON headers, applies Next.js tags, parses JSON.
export async function backendFetchJSON<T>(opts: BackendFetchOptions): Promise<BackendFetchJSONResult<T>> {
  const {
    path, scope, body, tags, context,
    method      = 'GET',
    logLabel    = 'backendFetch',
    contentType = 'application/json',
    accept      = 'application/json',
    audience    = 'pg-query-client-mcp'
  } = opts;

  const ctx = context ?? await getHeadersContextOrNull();
  if (!ctx) {
    return { ok: false, status: 400, error: 'missing-context' };
  }

  const backendJwt = await getBackendAccessTokenOnBehalfOf({
    audience,
    scope,
    headersContext: ctx
  });

  const urlBase = process.env.PG_QUERY_CLIENT_SERVER_URL || '';
  const url = `${urlBase}${path.startsWith('/') ? '' : '/'}${path}`;

  const requestHeaders: Record<string, string> = {
    'accept'        : accept,
    'authorization' : backendJwt ? `Bearer ${backendJwt}` : ''
  };

  if (contentType) {
    requestHeaders['content-type'] = contentType;
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

  console.log(
    `[${logLabel}] ${method}`,
    url,
    'headers:',
    JSON.stringify(requestHeaders),
    'body: ' + (init.body ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : '')
  );

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
      console.log('[backendFetchJSON] responsePayload', responsePayload);
    } catch (jsonError) {
      console.error(`[${logLabel}] failed to parse JSON response`, formatError(jsonError));
      return { ok: false, status: res.status, error: formatError(jsonError), context: ctx };
    }

    return { ok: true, status: res.status, data: responsePayload, context: ctx };
  } catch (error) {
    console.error(`[${logLabel}] network error`, formatError(error));
    return { ok: false, status: 0, error, context: ctx };
  }
}
