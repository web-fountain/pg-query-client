import type { JWTPayload }                from 'jose';
import type { NextRequest }               from 'next/server';
import type { LogLevel }                  from '@Observability/types';

import { NextResponse }                   from 'next/server';
import { jwtVerify, createRemoteJWKSet }  from 'jose';

import { logJson }                        from '@Observability/edge/logger';
import { formatError }                    from '@Utils/error';


type MultitenantClaims = JWTPayload & {
  tenant_id?   : string;
  opspace_id?  : string;
  sub?         : string;
};

// AIDEV-NOTE: Structured proxy logging via observability logger. Never log raw tokens,
// cookies, or Authorization headers; prefer high-signal booleans / identifiers.
const DEBUG_ENABLED = (process.env.PGQC_LOG_LEVEL || '').toLowerCase() === 'debug';

// AIDEV-NOTE: UUID validator/generator for correlation IDs. We only trust IDs that
// match the canonical UUID shape; all others are replaced with a new UUID.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

function createCorrelationIdUuid(): string {
  return crypto.randomUUID();
}

// AIDEV-NOTE: Cheap early-return for debug logs when DEBUG is disabled so we avoid
// building large payloads on hot paths.
function logProxy(level: LogLevel, span: string, payload: Record<string, unknown>): void {
  if (level === 'debug' && !DEBUG_ENABLED) return;

  logJson(level, {
    event : 'proxy',
    span  : span,
    ...payload
  });
}

// AIDEV-NOTE: Prefer configuring either JWKS URL (RS256/EdDSA) or HMAC secret (HS256) for verification.
//   - PGQ_BROWSER_JWKS_URL: remote JWKS endpoint for asymmetric tokens
//   - PGQC_BROWSER_JWT_SECRET: HMAC secret for HS256 tokens (dev/local)
//   - PGQC_BROWSER_JWT_ISSUER / PGQC_BROWSER_JWT_AUDIENCE: optional validation hints
const JWKS_URL          = process.env.PGQC_BROWSER_JWKS_URL     || '';
const HMAC_SECRET       = process.env.PGQC_BROWSER_JWT_SECRET   || '';
const EXPECTED_ISSUER   = process.env.PGQC_BROWSER_JWT_ISSUER   || undefined;
const EXPECTED_AUDIENCE = process.env.PGQC_BROWSER_JWT_AUDIENCE || undefined;

async function verifyBrowserJwt(token: string): Promise<MultitenantClaims | null> {
  try {
    if (JWKS_URL) {
      // AIDEV-NOTE: RS256/EdDSA verification via JWKS.
      if (DEBUG_ENABLED) {
        logProxy('debug', 'jwt-verify', {
          strategy : 'jwks',
          hasToken : Boolean(token)
        });
      }
      const jwks        = createRemoteJWKSet(new URL(JWKS_URL));
      const { payload } = await jwtVerify(token, jwks, {
        issuer          : EXPECTED_ISSUER,
        audience        : EXPECTED_AUDIENCE,
        // AIDEV-NOTE: Allow minor clock skew between browser and server in development.
        clockTolerance  : 60
      });
      if (DEBUG_ENABLED) {
        logProxy('debug', 'jwt-verified', {
          strategy  : 'jwks',
          iss       : (payload as JWTPayload).iss,
          aud       : (payload as JWTPayload).aud,
          sub       : (payload as JWTPayload).sub
        });
      } else {
        logProxy('info', 'jwt-verified', {
          strategy: 'jwks'
        });
      }
      return payload as MultitenantClaims;
    }

    if (HMAC_SECRET) {
      // AIDEV-NOTE: HS256 verification for local/dev.
      if (DEBUG_ENABLED) {
        logProxy('debug', 'jwt-verify', {
          strategy : 'hs256',
          hasToken : Boolean(token)
        });
      }
      const key         = new TextEncoder().encode(HMAC_SECRET);
      const { payload } = await jwtVerify(token, key, {
        algorithms      : ['HS256'],
        issuer          : EXPECTED_ISSUER,
        audience        : EXPECTED_AUDIENCE,
        // AIDEV-NOTE: Allow minor clock skew between browser and server in development.
        clockTolerance  : 60
      });
      if (DEBUG_ENABLED) {
        logProxy('debug', 'jwt-verified', {
          strategy  : 'hs256',
          iss       : (payload as JWTPayload).iss,
          aud       : (payload as JWTPayload).aud,
          sub       : (payload as JWTPayload).sub
        });
      } else {
        logProxy('info', 'jwt-verified', {
          strategy: 'hs256'
        });
      }
      return payload as MultitenantClaims;
    }

    // AIDEV-QUESTION: No key material configured. Should we reject or allow decode-only?
    // For safety, do not trust unverified tokens.
    logProxy('warn', 'jwt-verify', {
      strategy: 'none',
      message : 'No JWKS or HMAC secret configured; skipping JWT verification.'
    });
    return null;
  } catch (err) {
    logProxy('error', 'jwt-verify', {
      message       : 'JWT verification failed',
      errorName     : err instanceof Error ? err.name : undefined,
      errorMessage  : DEBUG_ENABLED ? formatError(err) : undefined
    });
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  const method = request.method;
  const path   = request.nextUrl.pathname;

  const incomingCorrelationId = request.headers.get('x-correlation-id');
  const hasValidIncoming      = isUuid(incomingCorrelationId);
  const correlationId         = hasValidIncoming
    ? (incomingCorrelationId as string).toLowerCase()
    : createCorrelationIdUuid();

  logProxy(hasValidIncoming ? 'debug' : 'info', 'incoming', {
    method        : method,
    path          : path,
    correlationId : correlationId
  });
  const token = request.cookies.get('pg-query-client-jwt')?.value || '';
  if (!token) {
    logProxy('debug', 'jwt-missing', {
      method        : method,
      path          : path,
      correlationId : correlationId,
      message       : 'no pg-query-client-jwt cookie present; skipping'
    });
    return NextResponse.next();
  }

  const claims = await verifyBrowserJwt(token);
  if (!claims) {
    logProxy('warn', 'claims-missing', {
      method        : method,
      path          : path,
      correlationId : correlationId,
      message       : 'no verified claims; skipping header injection'
    });
    return NextResponse.next();
  }

  const tenantId    = typeof claims.tenant_id  === 'string' ? claims.tenant_id  : '';
  const opspaceId   = typeof claims.opspace_id === 'string' ? claims.opspace_id : '';
  const operatorId  = typeof claims.sub        === 'string' ? claims.sub        : '';
  if (tenantId && opspaceId) {
    logProxy('info', 'context-detected', {
      method,
      path,
      correlationId,
      hasTenantId   : Boolean(tenantId),
      hasOpspaceId  : Boolean(opspaceId),
      hasOperatorId : Boolean(operatorId)
    });
    if (DEBUG_ENABLED) {
      logProxy('debug', 'context-values', {
        method,
        path,
        correlationId,
        tenantId,
        opspaceId,
        operatorId
      });
    }
  } else {
    logProxy('warn', 'context-missing', {
      method        : method,
      path          : path,
      correlationId : correlationId,
      hasTenantId   : Boolean(tenantId),
      hasOpspaceId  : Boolean(opspaceId),
      hasOperatorId : Boolean(operatorId),
      message       : 'verified JWT missing tenant/opspace claims; skipping header injection'
    });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);
  if (tenantId)   requestHeaders.set('x-tenant-id'  , tenantId);
  if (opspaceId)  requestHeaders.set('x-opspace-id' , opspaceId);
  if (operatorId) requestHeaders.set('x-operator-id', operatorId);
  logProxy(DEBUG_ENABLED ? 'debug' : 'info', 'headers-injected', {
    method,
    path,
    correlationId,
    xTenant   : Boolean(tenantId),
    xOpspace  : Boolean(opspaceId),
    xOperator : Boolean(operatorId)
  });

  // AIDEV-NOTE: Use request headers to pass internal context upstream (server-only).
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  return response;
}


// AIDEV-NOTE: Run for all non-static paths; exclude common asset/metadata paths and
// dev-only tooling like React DevTools' installHook source map. This avoids noisy
// "Missing required headers" logs when tools request these resources without JWTs.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opspace/installHook.js.map|queries/installHook.js.map).*)'
  ]
};
