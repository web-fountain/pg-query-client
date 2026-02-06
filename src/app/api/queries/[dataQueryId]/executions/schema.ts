// AIDEV-NOTE: Local AJV schemas for query execution route input validation.
// Keep this schema aligned with the backend contract for:
//   POST /queries/:dataQueryId/executions

// Canonical UUIDv7 shape: xxxxxxxx-xxxx-7xxx-[89ab]xxx-xxxxxxxxxxxx (lowercase hex).
const UUIDV7_PATTERN       = '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
const MAX_QUERY_TEXT_CHARS = 200_000;

const QueryExecutionParamsSchema = {
  $id: 'QueryExecutionParams',
  type: 'object',
  required: ['dataQueryId'],
  additionalProperties: false,
  properties: {
    dataQueryId: {
      type: 'string',
      format: 'uuid',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataQueryId must be a valid UUIDv7',
        format: 'dataQueryId must be a valid UUIDv7',
        pattern: 'dataQueryId must be a valid UUIDv7'
      }
    }
  },
  errorMessage: {
    required: { dataQueryId: 'dataQueryId is required' },
    additionalProperties: 'Only dataQueryId is allowed in params'
  }
} as const;

const QueryExecutionBodySchema = {
  $id: 'QueryExecutionBody',
  type: 'object',
  required: ['dataQueryExecutionId', 'dataSourceCredentialId', 'queryText'],
  additionalProperties: false,
  properties: {
    dataQueryExecutionId: {
      type: 'string',
      format: 'uuid',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataQueryExecutionId must be a valid UUIDv7',
        format: 'dataQueryExecutionId must be a valid UUIDv7',
        pattern: 'dataQueryExecutionId must be a valid UUIDv7'
      }
    },
    dataSourceCredentialId: {
      type: 'string',
      format: 'uuid',
      pattern: UUIDV7_PATTERN,
      errorMessage: {
        type: 'dataSourceCredentialId must be a valid UUIDv7',
        format: 'dataSourceCredentialId must be a valid UUIDv7',
        pattern: 'dataSourceCredentialId must be a valid UUIDv7'
      }
    },
    queryText: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_QUERY_TEXT_CHARS,
      // AIDEV-NOTE: Reject whitespace-only SQL; treat it as empty.
      pattern: '\\S',
      errorMessage: {
        type: 'queryText must be a string',
        minLength: 'queryText must not be empty',
        maxLength: 'queryText is too large',
        pattern: 'queryText must not be empty'
      }
    }
  },
  errorMessage: {
    required: {
      dataQueryExecutionId: 'dataQueryExecutionId is required',
      dataSourceCredentialId: 'dataSourceCredentialId is required',
      queryText: 'queryText is required'
    },
    additionalProperties: 'Only dataQueryExecutionId, dataSourceCredentialId, and queryText are allowed in body'
  }
} as const;


export {
  MAX_QUERY_TEXT_CHARS,
  QueryExecutionBodySchema,
  QueryExecutionParamsSchema,
  UUIDV7_PATTERN
};
