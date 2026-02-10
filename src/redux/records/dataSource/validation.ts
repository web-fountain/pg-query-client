import type {
  DataSource,
  PostgresDataSourceTestPayload,
  ReconnectDataSourceCredentialPayload
}                                       from '@Types/dataSource';
import type { FieldError }              from '@Errors/fieldError';
import type { DataSourceDraft }         from './types';

import { createAjv }                    from '@Utils/ajv/createAjv';
import { toFieldErrors }                from '@Utils/ajv/toFieldErrors';


// Canonical UUIDv7 shape: xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx (lowercase hex).
const UUIDV7_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

function normalizeOptionalTrimmedString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRequiredString(value: string): string {
  return (value || '').trim();
}

// AIDEV-NOTE: Mirrors backend schema for POST /data-sources/test (no dataSourceId, no persistSecret).
const PostgresDataSourceTestPayloadSchema = {
  $id: 'PostgresDataSourceTestPayload',
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'name', 'sslMode', 'host', 'port', 'username', 'password', 'database'],
  properties: {
    kind: {
      type: 'string',
      enum: ['postgres'],
      errorMessage: {
        type: 'kind must be a string',
        enum: 'kind must be \"postgres\"'
      }
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 80,
      errorMessage: {
        type: 'name must be a string',
        minLength: 'name must be at least 1 character',
        maxLength: 'name must be at most 80 characters'
      }
    },
    sslMode: {
      type: 'string',
      enum: ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'],
      errorMessage: {
        type: 'sslMode must be a string',
        enum: 'sslMode must be one of: disable, prefer, require, verify-ca, verify-full'
      }
    },
    host: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      errorMessage: {
        type: 'host must be a string',
        minLength: 'host must be at least 1 character',
        maxLength: 'host must be at most 255 characters'
      }
    },
    port: {
      type: 'integer',
      minimum: 1,
      maximum: 65535,
      errorMessage: {
        type: 'port must be an integer',
        minimum: 'port must be at least 1',
        maximum: 'port must be at most 65535'
      }
    },
    username: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'username must be a string',
        minLength: 'username must be at least 1 character',
        maxLength: 'username must be at most 128 characters'
      }
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      errorMessage: {
        type: 'password must be a string',
        minLength: 'password must be at least 1 character',
        maxLength: 'password must be at most 2048 characters'
      }
    },
    database: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'database must be a string',
        minLength: 'database must be at least 1 character',
        maxLength: 'database must be at most 128 characters'
      }
    }
  },
  errorMessage: {
    required: {
      kind: 'kind is required',
      name: 'name is required',
      sslMode: 'sslMode is required',
      host: 'host is required',
      port: 'port is required',
      username: 'username is required',
      password: 'password is required',
      database: 'database is required'
    },
    additionalProperties: 'Only kind, name, sslMode, host, port, username, password, and database are allowed in body'
  }
} as const;

const PostgresDataSourceCreateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'dataSourceId', 'name', 'sslMode', 'host', 'port', 'username', 'password', 'database'],
  properties: {
    kind: { const: 'postgres' },
    dataSourceId: {
      type: 'string',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataSourceId must be a string',
        pattern: 'dataSourceId must be a valid UUIDv7'
      }
    },
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 64,
      errorMessage: {
        type: 'name must be a string',
        minLength: 'name must be at least 3 characters',
        maxLength: 'name must be at most 64 characters'
      }
    },
    description: {
      type: 'string',
      minLength: 3,
      maxLength: 1024,
      errorMessage: {
        type: 'description must be a string',
        minLength: 'description must be at least 3 characters',
        maxLength: 'description must be at most 1024 characters'
      }
    },
    targetLabel: {
      type: 'string',
      minLength: 1,
      maxLength: 512,
      errorMessage: {
        type: 'targetLabel must be a string',
        minLength: 'targetLabel must be at least 1 character',
        maxLength: 'targetLabel must be at most 512 characters'
      }
    },
    sslMode: {
      type: 'string',
      enum: ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'],
      errorMessage: {
        type: 'sslMode must be a string',
        enum: 'sslMode must be one of: disable, prefer, require, verify-ca, verify-full'
      }
    },
    persistSecret: {
      type: 'boolean',
      errorMessage: {
        type: 'persistSecret must be true or false'
      }
    },
    host: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      errorMessage: {
        type: 'host must be a string',
        minLength: 'host must be at least 1 character',
        maxLength: 'host must be at most 255 characters'
      }
    },
    port: {
      type: 'integer',
      minimum: 1,
      maximum: 65535,
      errorMessage: {
        type: 'port must be an integer',
        minimum: 'port must be at least 1',
        maximum: 'port must be at most 65535'
      }
    },
    username: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'username must be a string',
        minLength: 'username must be at least 1 character',
        maxLength: 'username must be at most 128 characters'
      }
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      errorMessage: {
        type: 'password must be a string',
        minLength: 'password must be at least 1 character',
        maxLength: 'password must be at most 2048 characters'
      }
    },
    database: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'database must be a string',
        minLength: 'database must be at least 1 character',
        maxLength: 'database must be at most 128 characters'
      }
    }
  },
  errorMessage: {
    required: {
      kind: 'kind is required',
      dataSourceId: 'dataSourceId is required',
      name: 'name is required',
      sslMode: 'sslMode is required',
      host: 'host is required',
      port: 'port is required',
      username: 'username is required',
      password: 'password is required',
      database: 'database is required'
    },
    additionalProperties: 'Only postgres fields for host/port/username/password mode are allowed in body'
  }
} as const;

const PgliteDataSourceCreateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'dataSourceId', 'name', 'location', 'database', 'username'],
  properties: {
    kind: { const: 'pglite' },
    dataSourceId: {
      type: 'string',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataSourceId must be a string',
        pattern: 'dataSourceId must be a valid UUIDv7'
      }
    },
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 64,
      errorMessage: {
        type: 'name must be a string',
        minLength: 'name must be at least 3 characters',
        maxLength: 'name must be at most 64 characters'
      }
    },
    description: {
      type: 'string',
      minLength: 3,
      maxLength: 1024,
      errorMessage: {
        type: 'description must be a string',
        minLength: 'description must be at least 3 characters',
        maxLength: 'description must be at most 1024 characters'
      }
    },
    targetLabel: {
      type: 'string',
      minLength: 1,
      maxLength: 512,
      errorMessage: {
        type: 'targetLabel must be a string',
        minLength: 'targetLabel must be at least 1 character',
        maxLength: 'targetLabel must be at most 512 characters'
      }
    },
    location: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      errorMessage: {
        type: 'location must be a string',
        minLength: 'location must be at least 1 character',
        maxLength: 'location must be at most 2048 characters'
      }
    },
    database: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'database must be a string',
        minLength: 'database must be at least 1 character',
        maxLength: 'database must be at most 128 characters'
      }
    },
    username: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
      errorMessage: {
        type: 'username must be a string',
        minLength: 'username must be at least 1 character',
        maxLength: 'username must be at most 128 characters'
      }
    }
  },
  errorMessage: {
    additionalProperties: 'Only pglite fields are allowed in body'
  }
} as const;

// AIDEV-NOTE: Mirrors backend schema for POST /data-sources (create).
const DataSourceCreatePayloadSchema = {
  $id: 'DataSourceCreatePayload',
  oneOf: [
    PostgresDataSourceCreateSchema,
    PgliteDataSourceCreateSchema
  ],
  errorMessage: {
    oneOf: 'Body must match exactly one supported data-source shape (postgres host/port/username/password OR pglite).'
  }
} as const;

// AIDEV-NOTE: Mirrors backend schema for POST /data-sources/credentials/:dataSourceCredentialId/reconnect.
const ReconnectDataSourceCredentialPayloadSchema = {
  $id: 'ReconnectDataSourceCredentialPayload',
  type: 'object',
  additionalProperties: false,
  required: ['dataSourceCredentialId', 'password'],
  properties: {
    dataSourceCredentialId: {
      type: 'string',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataSourceCredentialId must be a string',
        pattern: 'dataSourceCredentialId must be a valid UUIDv7'
      }
    },
    password: {
      type: 'string',
      minLength: 1,
      maxLength: 2048,
      errorMessage: {
        type: 'password must be a string',
        minLength: 'password must be at least 1 character',
        maxLength: 'password must be at most 2048 characters'
      }
    },
    persistSecret: {
      type: 'boolean',
      errorMessage: {
        type: 'persistSecret must be true or false'
      }
    }
  },
  errorMessage: {
    required: {
      dataSourceCredentialId: 'dataSourceCredentialId is required',
      password: 'password is required'
    },
    additionalProperties: 'Only dataSourceCredentialId, password, and persistSecret are allowed in body'
  }
} as const;

const ajv = createAjv();

const validatePostgresDataSourceTestPayloadImpl = ajv.compile<PostgresDataSourceTestPayload>(PostgresDataSourceTestPayloadSchema);
const validateDataSourceCreatePayloadImpl       = ajv.compile<DataSource>(DataSourceCreatePayloadSchema);
const validateReconnectDataSourceCredentialPayloadImpl = ajv.compile<ReconnectDataSourceCredentialPayload>(ReconnectDataSourceCredentialPayloadSchema);

export function validatePostgresDataSourceTestPayload(payload: PostgresDataSourceTestPayload): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validatePostgresDataSourceTestPayloadImpl(payload) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: toFieldErrors(validatePostgresDataSourceTestPayloadImpl.errors) };
}

export function validateDataSourceCreatePayload(payload: DataSource): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validateDataSourceCreatePayloadImpl(payload) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: toFieldErrors(validateDataSourceCreatePayloadImpl.errors) };
}

export function validateReconnectDataSourceCredentialPayload(payload: ReconnectDataSourceCredentialPayload): { ok: true } | { ok: false; errors: FieldError[] } {
  const ok = validateReconnectDataSourceCredentialPayloadImpl(payload) as boolean;
  if (ok) return { ok: true };
  return { ok: false, errors: toFieldErrors(validateReconnectDataSourceCredentialPayloadImpl.errors) };
}

export function validateDataSourceDraftForTest(draft: DataSourceDraft): { ok: true; data: PostgresDataSourceTestPayload } | { ok: false; errors: FieldError[] } {
  if (draft.kind !== 'postgres') {
    return { ok: false, errors: [{ path: '/kind', message: 'kind must be \"postgres\"' }] };
  }

  const payload: Record<string, unknown> = {
    kind: 'postgres',
    name: normalizeRequiredString(draft.name),
    sslMode: draft.sslMode
  };

  if (typeof draft.host     === 'string') payload.host     = normalizeRequiredString(draft.host);
  if (typeof draft.port     === 'number') payload.port     = draft.port;
  if (typeof draft.username === 'string') payload.username = normalizeRequiredString(draft.username);
  if (typeof draft.password === 'string') payload.password = draft.password;
  if (typeof draft.database === 'string') payload.database = normalizeRequiredString(draft.database);

  const result = validatePostgresDataSourceTestPayload(payload as PostgresDataSourceTestPayload);
  if (!result.ok) return result;

  return { ok: true, data: payload as PostgresDataSourceTestPayload };
}

export function validateDataSourceDraftForCreate(draft: DataSourceDraft): { ok: true; data: DataSource } | { ok: false; errors: FieldError[] } {
  const payload = buildCreatePayloadFromDraft(draft);
  const result = validateDataSourceCreatePayload(payload as DataSource);
  if (!result.ok) return result;
  return { ok: true, data: payload as DataSource };
}

function buildCreatePayloadFromDraft(draft: DataSourceDraft): Record<string, unknown> {
  if (draft.kind === 'postgres') {
    const out: Record<string, unknown> = {
      kind: 'postgres',
      dataSourceId: draft.dataSourceId,
      name: normalizeRequiredString(draft.name),
      sslMode: draft.sslMode,
      persistSecret: draft.persistSecret
    };

    const description = normalizeOptionalTrimmedString(draft.description);
    if (description) out.description = description;

    const targetLabel = normalizeOptionalTrimmedString(draft.targetLabel);
    if (targetLabel) out.targetLabel = targetLabel;

    if (typeof draft.host === 'string') out.host = normalizeRequiredString(draft.host);
    if (typeof draft.port === 'number') out.port = draft.port;
    if (typeof draft.username === 'string') out.username = normalizeRequiredString(draft.username);
    if (typeof draft.password === 'string') out.password = draft.password;
    if (typeof draft.database === 'string') out.database = normalizeRequiredString(draft.database);

    return out;
  }

  const out: Record<string, unknown> = {
    kind: 'pglite',
    dataSourceId: draft.dataSourceId,
    name: normalizeRequiredString(draft.name)
  };

  const description = normalizeOptionalTrimmedString(draft.description);
  if (description) out.description = description;

  const targetLabel = normalizeOptionalTrimmedString(draft.targetLabel);
  if (targetLabel) out.targetLabel = targetLabel;

  if (typeof draft.location === 'string') out.location = normalizeRequiredString(draft.location);
  if (typeof draft.database === 'string') out.database = normalizeRequiredString(draft.database);
  if (typeof draft.username === 'string') out.username = normalizeRequiredString(draft.username);

  return out;
}
