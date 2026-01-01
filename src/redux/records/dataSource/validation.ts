import type { FieldError }      from '@Errors/fieldError';
import type { DataSourceDraft } from './types';

import Ajv                      from 'ajv';
import addErrors                from 'ajv-errors';
import addFormats               from 'ajv-formats';


// AIDEV-NOTE: AJV instance for dbConnections validations. We enable strict mode but
// disable `strictRequired` because the anyOf sub-schemas reference properties defined
// at the parent level, which is valid JSON Schema but trips AJV's strict checks.
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
addErrors(ajv);

// AIDEV-NOTE: Keep schemas as plain objects; JSONSchemaType doesn't play well with unions + branded types.
const DataSourceDraftSchema = {
  $id: 'DataSourceDraft',
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'serverGroupName', 'sslMode'],
  properties: {
    kind: {
      type: 'string',
      enum: ['postgres'],
      errorMessage: {
        type: 'Kind must be a string',
        enum: 'Kind must be postgres'
      }
    },
    serverGroupName: {
      type: 'string',
      minLength: 1,
      maxLength: 80,
      errorMessage: {
        type: 'Server group name must be a string',
        minLength: 'Server group name is required',
        maxLength: 'Server group name must be at most 80 characters'
      }
    },
    sslMode: {
      type: 'string',
      enum: ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'],
      errorMessage: {
        type: 'TLS mode must be a string',
        enum: 'TLS mode must be one of: disable, prefer, require, verify-ca, verify-full'
      }
    },
    persistSecret: {
      type: 'boolean',
      errorMessage: {
        type: 'Save password must be true or false'
      }
    },
    dataSourceUri: {
      type: 'string',
      minLength: 1,
      maxLength: 4096,
      // AIDEV-NOTE: Accept custom schemes like postgres:// and postgresql://.
      format: 'uri',
      errorMessage: {
        type: 'Connection string must be a string',
        minLength: 'Connection string is required',
        maxLength: 'Connection string must be at most 4096 characters',
        format: 'Connection string must be a valid URI'
      }
    },
    host: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      errorMessage: {
        type: 'Host must be a string',
        minLength: 'Host is required',
        maxLength: 'Host must be at most 255 characters'
      }
    },
    port: {
      type: 'integer',
      minimum: 1,
      maximum: 65535,
      errorMessage: {
        type: 'Port must be a number',
        minimum: 'Port must be between 1 and 65535',
        maximum: 'Port must be between 1 and 65535'
      }
    },
    username: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'User must be a string',
        minLength: 'User is required',
        maxLength: 'User must be at most 128 characters'
      }
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      errorMessage: {
        type: 'Password must be a string',
        minLength: 'Password is required',
        maxLength: 'Password must be at most 2048 characters'
      }
    },
    database: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'Database name must be a string',
        minLength: 'Database name is required',
        maxLength: 'Database name must be at most 128 characters'
      }
    }
  },
  anyOf: [
    { required: ['dataSourceUri'] },
    { required: ['host', 'port', 'username', 'password'] }
  ],
  errorMessage: {
    anyOf: 'Provide either a connection string or host/port/user/password.',
    additionalProperties: 'Only known connection fields are allowed'
  }
} as const;

const validateDataSourceDraftImpl = ajv.compile<DataSourceDraft>(DataSourceDraftSchema);


export function validateDataSourceDraft(payload: DataSourceDraft): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validateDataSourceDraftImpl(payload) as boolean;
  if (ok) return { ok: true };

  const errors = (validateDataSourceDraftImpl.errors || []).map((e) => {
    const missing = (e.params as Record<string, unknown> | undefined)?.['missingProperty'] as string | undefined;
    const path = e.instancePath || (missing ? `/${missing}` : '');
    return { path, message: e.message || 'Invalid value' };
  });

  return { ok: false, errors };
}
