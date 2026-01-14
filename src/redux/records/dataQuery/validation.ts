import type {
  UpdateDataQuery,
  UpdateDataQueryName,
  UpdateDataQueryText
}                           from './types';
import type { FieldError }  from '@Errors/fieldError';

import { createAjv }        from '@Utils/ajv/createAjv';
import { toFieldErrors }    from '@Utils/ajv/toFieldErrors';

// AJV instance for dataQuery validations; strict + allErrors for rich feedback.
const ajv = createAjv();

// Canonical UUIDv7 shape: xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx (lowercase hex).
const UUIDV7_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

// AIDEV-NOTE: Schemas typed as plain objects; JSONSchemaType doesn't support branded types (UUIDv7).
// Runtime validation still enforces the same constraints via JSON Schema patterns.
const DataQueryNameSchema = {
  $id: 'UpdateDataQueryName',
  type: 'object',
  additionalProperties: false,
  required: ['dataQueryId', 'name'],
  properties: {
    dataQueryId: {
      type: 'string',
      format: 'uuid',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataQueryId must be a valid UUIDv7',
        format: 'dataQueryId must be a valid UUIDv7'
      }
    },
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 64,
      errorMessage: {
        type: 'name must be a valid string',
        minLength: 'name must be at least 3 characters',
        maxLength: 'name must be at most 64 characters'
      }
    }
  },
  errorMessage: {
    required: {
      dataQueryId: 'dataQueryId is required',
      name: 'name is required'
    },
    additionalProperties: 'Only dataQueryId and name are allowed'
  }
} as const;

const DataQueryTextSchema = {
  $id: 'UpdateDataQueryText',
  type: 'object',
  additionalProperties: false,
  required: ['dataQueryId', 'queryText'],
  properties: {
    dataQueryId: {
      type: 'string',
      format: 'uuid',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataQueryId must be a valid UUIDv7',
        format: 'dataQueryId must be a valid UUIDv7'
      }
    },
    queryText: {
      type: 'string',
      minLength: 0,
      maxLength: 1048576,
      errorMessage: {
        type: 'queryText must be a valid string',
        maxLength: 'queryText must be at most 1048576 characters'
      }
    }
  },
  errorMessage: {
    required: {
      dataQueryId: 'dataQueryId is required',
      queryText: 'queryText is required'
    },
    additionalProperties: 'Only dataQueryId and queryText are allowed'
  }
} as const;

const UpdateDataQuerySchema = {
  $id: 'UpdateDataQuery',
  type: 'object',
  additionalProperties: false,
  required: ['dataQueryId'],
  properties: {
    dataQueryId: {
      type: 'string',
      format: 'uuid',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataQueryId must be a valid UUIDv7',
        format: 'dataQueryId must be a valid UUIDv7'
      }
    },
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 64,
      errorMessage: {
        type: 'name must be a valid string',
        minLength: 'name must be at least 3 characters',
        maxLength: 'name must be at most 64 characters'
      }
    },
    queryText: {
      type: 'string',
      minLength: 0,
      maxLength: 1048576,
      errorMessage: {
        type: 'queryText must be a valid string',
        maxLength: 'queryText must be at most 1048576 characters'
      }
    }
  },
  // At least one of name or queryText must be present (both allowed).
  anyOf: [
    {
      properties: { name: {} },      // stub definition so strictRequired is satisfied
      required: ['name']
    },
    {
      properties: { queryText: {} }, // stub definition so strictRequired is satisfied
      required: ['queryText']
    }
  ],
  errorMessage: {
    required: {
      dataQueryId: 'dataQueryId is required'
    },
    anyOf: 'At least one of name or queryText must be provided',
    additionalProperties: 'Only dataQueryId, name and queryText are allowed'
  }
} as const;

const validateDataQueryNameImpl   = ajv.compile<UpdateDataQueryName>(DataQueryNameSchema);
const validateDataQueryTextImpl   = ajv.compile<UpdateDataQueryText>(DataQueryTextSchema);
const validateDataQueryUpdateImpl = ajv.compile<UpdateDataQuery>(UpdateDataQuerySchema);

function validateDataQueryName(payload: UpdateDataQueryName): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validateDataQueryNameImpl(payload) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: toFieldErrors(validateDataQueryNameImpl.errors) };
}

function validateDataQueryText(payload: UpdateDataQueryText): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validateDataQueryTextImpl(payload) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: toFieldErrors(validateDataQueryTextImpl.errors) };
}

function validateDataQueryUpdate(payload: UpdateDataQuery): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validateDataQueryUpdateImpl(payload) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: toFieldErrors(validateDataQueryUpdateImpl.errors) };
}

export {
  validateDataQueryName,
  validateDataQueryText,
  validateDataQueryUpdate
};
