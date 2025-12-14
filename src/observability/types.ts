// AIDEV-NOTE: Shared (runtime-agnostic) types for observability/logging.
// Keep this file free of Node/Next imports so it can be safely imported by any layer.

import type { ActionErrorKind }  from '@Errors/types';
import type { Base64Url22 }      from '@Types/primitives';


export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ActionOp = 'read' | 'write';

export type ActionLogContext = {
  tenantPublicId    : string;
  opspacePublicId   : string;
  operatorPublicId  : string;
};

export type ActionLogEvent = {
  event         : 'action';
  action        : string;
  op            : ActionOp;
  success       : boolean;
  durationMs    : number;

  // AIDEV-NOTE: Per-invocation id for UI ↔ server log correlation.
  requestId     : Base64Url22;

  // AIDEV-NOTE: Correlation id is propagated across server actions and backend calls.
  // Do NOT assume a specific format (UUID vs base64url); treat as opaque.
  correlationId : string;
  vercelId?     : string;

  // AIDEV-NOTE: Multitenancy context; omitted only when required headers are missing.
  ctx?          : ActionLogContext;

  // AIDEV-NOTE: Stable error taxonomy.
  errorCode?    : string;
  errorKind?    : ActionErrorKind;
  status?       : number;
  retryable?    : boolean;

  // AIDEV-NOTE: Safe summary only (IDs, lengths). Never include raw SQL/queryText.
  input?        : Record<string, unknown>;

  // AIDEV-NOTE: DEV-only detail gate is handled at call sites.
  errorMessage? : string;
};

// AIDEV-NOTE: Backend call log event emitted by `backendFetchJSON`.
export type BackendCallLogEvent = {
  event         : 'backendFetch';
  label         : string;
  method        : string;
  url           : string;
  status        : number;
  durationMs    : number;

  correlationId : string;
  vercelId?     : string;
  requestId?    : Base64Url22;
  ctx?          : ActionLogContext;

  errorCode?    : string;
  errorMessage? : string;
};

// AIDEV-NOTE: Domain-specific client audit events. Keep these narrow and safe.
// Policy: Never include raw SQL/queryText or secrets. Prefer IDs, counts, and lengths.
export type ClientAuditEvent =
  | {
    event           : 'query:execute';
    dataQueryId     : string;
    correlationId?  : string;
    requestId?      : Base64Url22;
  }
  | {
    event           : 'query:save';
    dataQueryId     : string;
    correlationId?  : string;
    requestId?      : Base64Url22;
  }
  | {
    event           : 'results:export';
    dataQueryId     : string;
    format          : 'csv' | 'json';
    rowCount        : number;
    correlationId?  : string;
    requestId?      : Base64Url22;
  }
  | {
    event : 'session:start';
  }
  | {
    event           : 'action:failed';
    action          : string;
    errorCode       : string;
    correlationId?  : string;
    requestId?      : Base64Url22;
  };

export type ClientAuditEnvelope = ClientAuditEvent & {
  at        : number;
  sessionId : string;
};
