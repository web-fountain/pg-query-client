import 'server-only';
import { randomBytes, createHmac } from 'crypto';

export type OboRequest = {
  audience        : string;   // Backend API audience
  scope?          : string[]; // Optional scopes for the backend token
  // AIDEV-NOTE: Authoritative context injected by proxy (required)
  headersContext  : {
    operatorPublicId : string;
    tenantPublicId   : string;
    opspacePublicId  : string;
  };
};

// AIDEV-NOTE: DEV signing config. Replace with RS256/EdDSA and real key management.
const DEV_ISSUER = process.env.PGQC_DEV_OBO_ISSUER || 'pg-query-ui-dev';
const DEV_AZP    = process.env.PGQC_DEV_AZP        || 'pg-query-ui';
const DEV_SECRET = process.env.PGQC_DEV_OBO_SECRET || 'dev-obo-secret';

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHs256(header: object, payload: object, secret: string): string {
  const headerB64  = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(data).digest();
  const sigB64 = base64url(sig);
  return `${data}.${sigB64}`;
}

export async function getBackendAccessTokenOnBehalfOf(req: OboRequest): Promise<string> {
  const ctx = req.headersContext;
  if (!ctx?.operatorPublicId || !ctx.tenantPublicId || !ctx.opspacePublicId) {
    throw new Error('OBO minting requires operatorPublicId, tenantPublicId, and opspacePublicId');
  }

  const operatorPublicId = ctx.operatorPublicId;
  const tenantPublicId   = ctx.tenantPublicId;
  const opspacePublicId  = ctx.opspacePublicId;

  // Build backend token claims (DEV: HS256). Use very short TTL.
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 5 * 60; // 5 minutes
  const jti = base64url(randomBytes(12));

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: Record<string, unknown> = {
    iss: DEV_ISSUER,
    aud: req.audience,
    sub: operatorPublicId,
    azp: DEV_AZP,
    iat: now,
    exp: exp,
    jti: jti,
    scope: Array.isArray(req.scope) ? req.scope.join(' ') : (req.scope || undefined),
    // Multitenancy context (still validate against path on backend)
    tenant_id: tenantPublicId,
    opspace_id: opspacePublicId,
    // Actor (UI server) acting on behalf of user
    act: { sub: DEV_AZP }
  };

  // AIDEV-NOTE: In production, prefer asymmetric keys (RS256/EdDSA) and rotate keys.
  return signHs256(header, payload, DEV_SECRET);
}
