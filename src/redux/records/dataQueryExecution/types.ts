import type { UUIDv7 } from '@Types/primitives';


export type DataQueryExecutionStatus =
  | 'running'
  | 'succeeded'
  | 'failed';

export type DataQueryExecution = {
  dataQueryExecutionId    : UUIDv7;
  dataQueryId             : UUIDv7;
  dataSourceCredentialId  : UUIDv7;
  status                   : DataQueryExecutionStatus;

  // AIDEV-NOTE: Do not persist raw SQL in execution records (security-first).
  // Use `dataQueryRecords[dataQueryId].current.queryText` as the source of truth.
  queryTextLen            : number;

  startedAt               : string; // ISO datetime
  finishedAt?             : string; // ISO datetime
  elapsedMs?              : number;

  rows?                   : unknown[]; // capped (currently 1000 rows max)
  rowCount?               : number | null;
  fields?                 : string[];
  isTruncated?            : boolean;

  message?                : string | null;
  errorCode?              : string;
  error?                  : string;
};

export type DataQueryExecutionRecord = Record<string, DataQueryExecution[]>;
