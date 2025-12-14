import 'server-only';

import type { ClientAuditEnvelope }     from '@Observability/types';
import type { ActionLogContext }        from '@Observability/types';

import { generateBase64Url22 }          from '@Utils/generateId';
import { getLogger, runWithLogContext } from '@Observability/server';


function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeSafeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function extractCtx(headers: Headers): ActionLogContext | undefined {
  const tenantPublicId   = headers.get('x-tenant-id') || '';
  const opspacePublicId  = headers.get('x-opspace-id') || '';
  const operatorPublicId = headers.get('x-operator-id') || '';

  if (!tenantPublicId || !opspacePublicId || !operatorPublicId) return undefined;
  return { tenantPublicId, opspacePublicId, operatorPublicId };
}

// AIDEV-NOTE: Validate + sanitize audit envelopes by constructing a new object that only
// includes allowlisted keys. This prevents accidental logging of sensitive fields.
function sanitizeAuditEnvelope(input: unknown): ClientAuditEnvelope | null {
  if (!isRecord(input)) return null;

  const at        = input.at;
  const sessionId = input.sessionId;
  const event     = input.event;

  if (!isFiniteNumber(at) || !isNonEmptyString(sessionId) || !isNonEmptyString(event)) return null;

  const correlationId = isNonEmptyString(input.correlationId) ? input.correlationId : undefined;
  const requestId     = isNonEmptyString(input.requestId) ? input.requestId : undefined;

  if (event === 'query:execute' || event === 'query:save') {
    if (!isNonEmptyString(input.dataQueryId)) return null;

    return {
      at            : at,
      sessionId     : sessionId,
      event         : event,
      dataQueryId   : input.dataQueryId,
      correlationId : correlationId,
      requestId     : requestId as any
    };
  }

  if (event === 'results:export') {
    if (!isNonEmptyString(input.dataQueryId)) return null;
    if (input.format !== 'csv' && input.format !== 'json') return null;
    if (!isNonNegativeSafeInt(input.rowCount)) return null;

    return {
      at            : at,
      sessionId     : sessionId,
      event         : event,
      dataQueryId   : input.dataQueryId,
      format        : input.format,
      rowCount      : input.rowCount,
      correlationId : correlationId,
      requestId     : requestId as any
    };
  }

  if (event === 'session:start') {
    return {
      at,
      sessionId,
      event
    };
  }

  if (event === 'action:failed') {
    if (!isNonEmptyString(input.action)) return null;
    if (!isNonEmptyString(input.errorCode)) return null;

    return {
      at            : at,
      sessionId     : sessionId,
      event         : event,
      action        : input.action,
      errorCode     : input.errorCode,
      correlationId : correlationId,
      requestId     : requestId as any
    };
  }

  return null;
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const audit = sanitizeAuditEnvelope(raw);
  if (!audit) {
    return new Response('Invalid audit event', { status: 400 });
  }

  const headers       = request.headers;
  const ctx           = extractCtx(headers);
  const vercelId      = headers.get('x-vercel-id') || undefined;
  const auditCorrelationId =
    ('correlationId' in audit && isNonEmptyString(audit.correlationId))
      ? audit.correlationId
      : undefined;
  const auditRequestId =
    ('requestId' in audit && isNonEmptyString(audit.requestId))
      ? audit.requestId
      : undefined;

  const correlationId = headers.get('x-correlation-id')
    || auditCorrelationId
    || generateBase64Url22();

  return runWithLogContext({
    correlationId : correlationId,
    vercelId      : vercelId,
    requestId     : auditRequestId as any,
    ctx           : ctx
  }, async () => {
    const logger = getLogger();
    logger.info({
      event: 'audit',
      audit
    });
    return new Response(null, { status: 204 });
  });
}
