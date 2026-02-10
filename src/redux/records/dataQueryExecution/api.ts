import type { UUIDv7 }  from '@Types/primitives';
import { isRecord }     from '@Utils/typeGuards/isRecord';


type PostQueryExecutionArgs = {
  dataQueryId: UUIDv7;
  dataQueryExecutionId: UUIDv7;
  dataSourceCredentialId: UUIDv7;
  queryText: string;
  signal?: AbortSignal;
};

type PostQueryExecutionResult =
  | { ok: false; message: string }
  | { ok: true; httpOk: boolean; status: number; payload: unknown; message: string | null; errorCode?: string };

function extractErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const errorValue = payload['error'];
  if (typeof errorValue === 'string' && errorValue.length > 0) {
    return errorValue;
  }

  if (isRecord(errorValue)) {
    const messageValue = errorValue['message'];
    if (typeof messageValue === 'string' && messageValue.length > 0) {
      return messageValue;
    }
  }

  const messageValue = payload['message'];
  if (typeof messageValue === 'string' && messageValue.length > 0) {
    return messageValue;
  }

  return null;
}

function extractErrorCode(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const errorValue = payload['error'];
  if (isRecord(errorValue)) {
    const codeValue = errorValue['code'];
    if (typeof codeValue === 'string' && codeValue.length > 0) {
      return codeValue;
    }
  }

  const codeValue = payload['code'];
  if (typeof codeValue === 'string' && codeValue.length > 0) {
    return codeValue;
  }

  return null;
}

export async function postQueryExecution(args: PostQueryExecutionArgs): Promise<PostQueryExecutionResult> {
  const {
    dataQueryId,
    dataQueryExecutionId,
    dataSourceCredentialId,
    queryText,
    signal
  } = args;

  try {
    const response = await fetch(`/api/queries/${dataQueryId}/executions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataQueryExecutionId,
        dataSourceCredentialId,
        queryText
      }),
      signal
    });

    const payloadUnknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errorCode = extractErrorCode(payloadUnknown);
      return {
        ok: true,
        httpOk: false,
        status: response.status,
        payload: payloadUnknown,
        message: extractErrorMessage(payloadUnknown) || 'Query failed',
        ...(errorCode ? { errorCode } : {})
      };
    }

    return {
      ok: true,
      httpOk: true,
      status: response.status,
      payload: payloadUnknown,
      message: null
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { ok: false, message };
  }
}
