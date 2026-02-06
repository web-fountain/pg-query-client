import type { UUIDv7 } from '@Types/primitives';


export type QueryExecutionBackendStatus = 'success' | 'error';

export type QueryExecutionBackendError = {
  code?   : string;
  message : string;
};

export type QueryExecutionSuccessData = {
  dataQueryExecutionId    : UUIDv7;
  dataQueryId             : UUIDv7;
  dataSourceCredentialId  : UUIDv7;
  status                  : 'success';
  startedAt               : string; // ISO 8601 date-time
  finishedAt              : string; // ISO 8601 date-time
  durationMs              : number;
  rowCount                : number | null;
  message                 : string;
  rows                    : Array<Record<string, unknown>>;
  error?                  : never;
};

export type QueryExecutionErrorData = {
  dataQueryExecutionId    : UUIDv7;
  dataQueryId             : UUIDv7;
  dataSourceCredentialId  : UUIDv7;
  status                  : 'error';
  startedAt               : string; // ISO 8601 date-time
  finishedAt              : string; // ISO 8601 date-time
  durationMs              : number;
  rowCount                : null;
  error                   : QueryExecutionBackendError;
  message?                : never;
  rows?                   : never;
};

export type QueryExecutionBackendData =
  | QueryExecutionSuccessData
  | QueryExecutionErrorData;

export type QueryExecutionApiResponse =
  | { ok: true; data: QueryExecutionBackendData }
  | { ok: false; error: { message: string } };
