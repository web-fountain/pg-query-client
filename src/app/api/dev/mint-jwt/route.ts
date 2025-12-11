import { createHmac } from 'crypto';


const TENANT_PUBLIC_ID    = 'Ho8YWHFD3MVjkoI70HIfbg';
const OPSPACE_PUBLIC_ID   = 'OI5wInHSKUw_Vb-CcczzRw';
const OPERATOR_PUBLIC_ID  = 'UEka9zVYjRHrZlHGBf7Chw';

// AIDEV-NOTE: Base64url helpers kept local to this route for isolation.
function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHs256(header: object, payload: object, secret: string): string {
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', secret).update(data).digest();
  const sigB64 = base64url(sig);
  return `${data}.${sigB64}`;
}

// AIDEV-NOTE: Dev JWT TTL (seconds).
const DEV_JWT_TTL_SEC: number = Number(process.env.PGQC_BROWSER_DEV_JWT_TTL_SECONDS || '3600');

export async function GET() {
  // AIDEV-NOTE: Disable in production.
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  const secret = process.env.PGQC_BROWSER_JWT_SECRET;
  if (!secret) {
    return new Response('Missing PGQC_BROWSER_JWT_SECRET', { status: 500 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' } as const;
  const payload = {
    iss: process.env.PGQC_BROWSER_JWT_ISSUER || 'https://pgqueryclient.dev',
    aud: process.env.PGQC_BROWSER_JWT_AUDIENCE || 'pg-query-ui',
    azp: 'pg-query-ui',
    sub: OPERATOR_PUBLIC_ID,
    tenant_id: TENANT_PUBLIC_ID,
    opspace_id: OPSPACE_PUBLIC_ID,
    scope: 'queries:write queries:read',
    iat: nowSec,
    exp: nowSec + DEV_JWT_TTL_SEC,
    jti: `dev-${Math.random().toString(36).slice(2)}`
  };

  const token = signHs256(header, payload, secret);
  return Response.json({ token, ttl: DEV_JWT_TTL_SEC });
}
