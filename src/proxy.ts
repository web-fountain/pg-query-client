import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';


type MultitenantClaims = JWTPayload & {
  tenant_id?: string;
  opspace_id?: string;
  sub?: string;
};

// AIDEV-NOTE: Minimal logger utilities; avoid logging PII unless PGQ_LOG_LEVEL=debug.
const LOG_LEVEL = process.env.PGQC_LOG_LEVEL || 'info';
const DEBUG_ENABLED = LOG_LEVEL === 'debug';
function logDebug(...args: unknown[]): void { if (DEBUG_ENABLED) console.debug('[proxy]', ...args); }
function logInfo(...args: unknown[]): void { console.log('[proxy]', ...args); }
function logWarn(...args: unknown[]): void { console.warn('[proxy]', ...args); }
function logError(...args: unknown[]): void { console.error('[proxy]', ...args); }

// AIDEV-NOTE: Prefer configuring either JWKS URL (RS256/EdDSA) or HMAC secret (HS256) for verification.
//   - PGQ_BROWSER_JWKS_URL: remote JWKS endpoint for asymmetric tokens
//   - PGQC_BROWSER_JWT_SECRET: HMAC secret for HS256 tokens (dev/local)
//   - PGQC_BROWSER_JWT_ISSUER / PGQC_BROWSER_JWT_AUDIENCE: optional validation hints
const JWKS_URL          = process.env.PGQC_BROWSER_JWKS_URL || '';
const HMAC_SECRET       = process.env.PGQC_BROWSER_JWT_SECRET || '';
const EXPECTED_ISSUER   = process.env.PGQC_BROWSER_JWT_ISSUER || undefined;
const EXPECTED_AUDIENCE = process.env.PGQC_BROWSER_JWT_AUDIENCE || undefined;

async function verifyBrowserJwt(token: string): Promise<MultitenantClaims | null> {
  try {
    logDebug('verifying browser JWT using', JWKS_URL ? 'JWKS' : (HMAC_SECRET ? 'HS256 secret' : 'no key configured'));
    if (JWKS_URL) {
      // AIDEV-NOTE: RS256/EdDSA verification via JWKS
      const jwks = createRemoteJWKSet(new URL(JWKS_URL));
      const { payload } = await jwtVerify(token, jwks, {
        issuer: EXPECTED_ISSUER,
        audience: EXPECTED_AUDIENCE,
        // AIDEV-NOTE: Allow minor clock skew between browser and server in development.
        clockTolerance: 60
      });
      logDebug('JWT verified via JWKS', {
        iss: (payload as JWTPayload).iss,
        aud: (payload as JWTPayload).aud,
        sub: (payload as JWTPayload).sub
      });
      return payload as MultitenantClaims;
    }

    if (HMAC_SECRET) {
      // AIDEV-NOTE: HS256 verification for local/dev
      const key = new TextEncoder().encode(HMAC_SECRET);
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: EXPECTED_ISSUER,
        audience: EXPECTED_AUDIENCE,
        // AIDEV-NOTE: Allow minor clock skew between browser and server in development.
        clockTolerance: 60
      });
      logDebug('JWT verified via HS256', {
        iss: (payload as JWTPayload).iss,
        aud: (payload as JWTPayload).aud,
        sub: (payload as JWTPayload).sub
      });
      return payload as MultitenantClaims;
    }

    // AIDEV-QUESTION: No key material configured. Should we reject or allow decode-only?
    // For safety, do not trust unverified tokens.
    logWarn('No JWKS or HMAC secret configured; skipping JWT verification.');
    return null;
  } catch (err) {
    logError('JWT verification failed:', err);
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  logDebug('incoming request', { method: request.method, path: request.nextUrl.pathname });
  const token = request.cookies.get('pg-query-client-jwt')?.value || '';
  if (!token) {
    logDebug('no pg-query-client-jwt cookie present; skipping');
    return NextResponse.next();
  }

  const claims = await verifyBrowserJwt(token);
  if (!claims) {
    logWarn('no verified claims; skipping header injection');
    return NextResponse.next();
  }

  const tenantId = typeof claims.tenant_id === 'string' ? claims.tenant_id : '';
  const opspaceId = typeof claims.opspace_id === 'string' ? claims.opspace_id : '';
  const operatorId = typeof claims.sub === 'string' ? claims.sub : '';
  if (tenantId && opspaceId) {
    logInfo('multitenancy context detected');
    logDebug('context values', { tenantId, opspaceId, operatorId });
  } else {
    logWarn('verified JWT missing tenant/opspace claims; skipping header injection');
  }

  const requestHeaders = new Headers(request.headers);
  if (tenantId) requestHeaders.set('x-tenant-id', tenantId);
  if (opspaceId) requestHeaders.set('x-opspace-id', opspaceId);
  if (operatorId) requestHeaders.set('x-operator-id', operatorId);
  logDebug('injecting headers where present', {
    xTenant: Boolean(tenantId),
    xOpspace: Boolean(opspaceId),
    xOperator: Boolean(operatorId)
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
