// AIDEV-NOTE: Shared (runtime-agnostic) types for observability/logging.
// Keep this file free of Node/Next imports so it can be safely imported by any layer.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type ActionOp = 'read' | 'write';

export type ActionLogContext = {
  tenantPublicId: string;
  opspacePublicId: string;
  operatorPublicId: string;
};

export type ActionLogEvent = {
  event: 'action';
  action: string;
  op: ActionOp;
  success: boolean;
  durationMs: number;
  ctx: ActionLogContext;
  correlationId: string;
  vercelId?: string;
  errorCode?: string;
  errorMessage?: string;
  input?: Record<string, unknown>;
};
