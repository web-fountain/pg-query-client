import type { JSONSchemaType } from 'ajv';
import type { UpdateDataQueryName } from './types';
import Ajv                          from 'ajv';
import addErrors                    from 'ajv-errors';
import addFormats                   from 'ajv-formats';


// AJV instance for dataQuery validations; strict + allErrors for rich feedback.
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
addErrors(ajv);

export type FieldError = { path: string; message: string };

// AIDEV-NOTE: 22-char base64url id and a 3–64 char name. No additional props.
const DataQueryNameSchema: JSONSchemaType<UpdateDataQueryName> = {
  $id: 'UpdateDataQueryName',
  type: 'object',
  additionalProperties: false,
  required: ['dataQueryId', 'name'],
  properties: {
    dataQueryId: {
      type: 'string',
      format: 'uuid',
      errorMessage: {
        type: 'dataQueryId must be a valid UUID',
        format: 'dataQueryId must be a valid UUID'
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

const validate = ajv.compile<UpdateDataQueryName>(DataQueryNameSchema as any);

// AIDEV-NOTE: Uniform validator interface used by action prepare/middleware.
function validateDataQueryName(payload: UpdateDataQueryName): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validate(payload) as boolean;
  if (ok) return { ok: true };

  const errors = (validate.errors || []).map(e => {
    const missing = (e.params as Record<string, unknown> | undefined)?.['missingProperty'] as string | undefined;
    const path = e.instancePath || (missing ? `/${missing}` : '');
    return { path, message: e.message || 'Invalid value' };
  });

  return { ok: false, errors };
}


export { validateDataQueryName };
