import 'server-only';

import type { ErrorObject } from 'ajv';

import type { FieldError }  from '@Errors/fieldError';
import type { UUIDv7 }      from '@Types/primitives';

import { createAjv }        from '@Utils/ajv/createAjv';
import { toFieldErrors }    from '@Utils/ajv/toFieldErrors';

import {
  QueryExecutionBodySchema,
  QueryExecutionParamsSchema
}                           from './schema';


type QueryExecutionParams = {
  dataQueryId : UUIDv7;
};

type QueryExecutionBody = {
  dataQueryExecutionId    : UUIDv7;
  dataSourceCredentialId  : UUIDv7;
  queryText               : string;
};

type OkResult<T> = { ok: true; value: T };
type FailResult  = { ok: false; status: number; errors: FieldError[]; message: string };

type ValidationResult<T> =
  | OkResult<T>
  | FailResult;

const ajv = createAjv();

const validateParamsImpl = ajv.compile<{ dataQueryId: string }>(QueryExecutionParamsSchema);
const validateBodyImpl   = ajv.compile<{ dataQueryExecutionId: string; dataSourceCredentialId: string; queryText: string }>(QueryExecutionBodySchema);

function firstMessage(errors: FieldError[]): string {
  const first = errors[0];
  if (first && typeof first.message === 'string' && first.message.length > 0) {
    return first.message;
  }
  return 'Invalid request.';
}

function statusFromBodyErrors(errors: ErrorObject[] | null | undefined): number {
  for (const err of (errors || [])) {
    if (err.keyword === 'maxLength' && err.instancePath === '/queryText') {
      return 413;
    }
  }
  return 400;
}

function validateQueryExecutionParams(value: unknown): ValidationResult<QueryExecutionParams> {
  const ok = validateParamsImpl(value) as boolean;
  if (!ok) {
    const errors = toFieldErrors(validateParamsImpl.errors);
    return { ok: false, status: 400, errors, message: firstMessage(errors) };
  }

  const record = value as { dataQueryId: string };
  return {
    ok: true,
    value: { dataQueryId: record.dataQueryId as UUIDv7 }
  };
}

function validateQueryExecutionBody(value: unknown): ValidationResult<QueryExecutionBody> {
  const ok = validateBodyImpl(value) as boolean;
  if (!ok) {
    const errors = toFieldErrors(validateBodyImpl.errors);
    const status = statusFromBodyErrors(validateBodyImpl.errors);
    return { ok: false, status, errors, message: firstMessage(errors) };
  }

  const record = value as { dataQueryExecutionId: string; dataSourceCredentialId: string; queryText: string };
  return {
    ok: true,
    value: {
      dataQueryExecutionId    : record.dataQueryExecutionId as UUIDv7,
      dataSourceCredentialId  : record.dataSourceCredentialId as UUIDv7,
      queryText               : record.queryText
    }
  };
}


export {
  validateQueryExecutionBody,
  validateQueryExecutionParams
};
