export type SqlRunSuccess = {
  rows: unknown[];
  rowCount: number;
  fields?: string[];
  elapsedMs: number;
};

export type SqlRunError = {
  error: string;
  elapsedMs: number;
};

export type SqlRunResult = SqlRunSuccess | SqlRunError;
