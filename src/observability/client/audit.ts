import type { ClientAuditEnvelope, ClientAuditEvent } from '../types';

// AIDEV-NOTE: Explicit client → server audit pipeline.
// This is intentionally small: it only ships domain-specific audit events for correlation/compliance.

const AUDIT_ENDPOINT         = '/api/audit';
const SESSION_ID_KEY         = 'pgqc.audit.sessionId';
const SESSION_START_SENT_KEY = 'pgqc.audit.sessionStartSent';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';

  try {
    const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;

    const next = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.sessionStorage.setItem(SESSION_ID_KEY, next);
    return next;
  } catch {
    // AIDEV-NOTE: sessionStorage may throw in hardened browsers; fall back to an in-memory-ish id.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function buildEnvelope(evt: ClientAuditEvent): ClientAuditEnvelope {
  return {
    ...evt,
    at        : Date.now(),
    sessionId : getOrCreateSessionId()
  };
}

export function logAudit(evt: ClientAuditEvent): void {
  if (typeof window === 'undefined') return;

  if (evt.event === 'session:start') {
    try {
      const alreadySent = window.sessionStorage.getItem(SESSION_START_SENT_KEY);
      if (alreadySent) return;
      window.sessionStorage.setItem(SESSION_START_SENT_KEY, '1');
    } catch {
      // ignore
    }
  }

  const envelope = buildEnvelope(evt);
  const body     = JSON.stringify(envelope);

  // AIDEV-NOTE: Prefer sendBeacon for unload-safe, fire-and-forget delivery.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const ok = navigator.sendBeacon(AUDIT_ENDPOINT, body);
    if (ok) return;
  }

  void fetch(AUDIT_ENDPOINT, {
    method    : 'POST',
    headers   : { 'content-type': 'application/json' },
    body      : body,
    keepalive : true
  }).catch(() => {});
}
