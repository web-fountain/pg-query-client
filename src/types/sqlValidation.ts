// AIDEV-NOTE: Shared types for validator RPC between main thread and worker.

export type ValidationMode = 'syntax' | 'schema';

export interface SessionContext {
  role?: string;
  searchPath?: string[];
  gucs?: Record<string, string | number>;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  sqlstate?: string;
  hint?: string;
  statementIndex: number;
  position?: number;
  line?: number;
  column?: number;
  length?: number;
}

export interface StatementRange {
  index: number;
  startOffset: number;
  endOffset: number;
  startLine: number;
  startColumn: number;
}

export interface ValidateRequest {
  requestId: string;
  sourceId: string;
  sqlText: string;
  mode: ValidationMode;
  session?: SessionContext;
  statementRanges?: StatementRange[];
  statements?: string[];
  requestSplit?: boolean;
  perStatementBudgetMs?: number;
  maxTotalBudgetMs?: number;
}

export interface ValidateResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  statements: Array<{ statementIndex: number; ok: boolean; diagnostics: Diagnostic[]; durationMs?: number }>;
  statementRanges: StatementRange[];
  serverVersion: string;
  totalDurationMs: number;
  mode: ValidationMode;
  mirrorVersion?: string;
}

export type WorkerIn =
  | { type: 'init' }
  | { type: 'dispose' }
  | { type: 'split'; sqlText: string }
  | { type: 'validate'; request: ValidateRequest };

export type WorkerOut =
  | { type: 'ready'; serverVersion: string }
  | { type: 'disposed' }
  | { type: 'splitResult'; statementRanges: StatementRange[] }
  | { type: 'validateResult'; requestId: string; result: ValidateResult }
  | { type: 'error'; code: 'INIT_FAILED' | 'VALIDATION_FAILED' | 'INTERNAL'; message: string };
