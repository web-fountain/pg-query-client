import type { Base64Url22 } from '@Types/primitives';

import type { ErrorCode }   from './codes';
import type { FieldError }  from './fieldError';


// `kind` is a coarse category for UX decisions; `code` is a stable taxonomy
// used for logs, analytics, and consistent handling across actions.
export type ActionErrorKind =
  | 'context'
  | 'auth'
  | 'validation'
  | 'resource'
  | 'rate-limit'
  | 'backend'
  | 'network'
  | 'unexpected';

export type ActionMeta = {
  // Stable action name (ex: 'tabs.open', 'queries.update').
  // See: `src/app/**/_actions/**/CONTEXT.md` for action naming maps.
  action    : string;
  requestId : Base64Url22;
  at        : number;
};

export type ActionError = {
  // Unique per action invocation; show this to users in critical error screens.
  // Use this id to correlate UI reports with server logs.
  id        : Base64Url22;
  kind      : ActionErrorKind;
  code      : ErrorCode;
  message   : string;
  status?   : number;
  retryable : boolean;
  fields?   : FieldError[];

  // For aggregators like bootstrap that call multiple actions.
  causes? : Array<{
    action  : string;
    id      : Base64Url22;
    kind    : ActionErrorKind;
    code    : ErrorCode;
    message : string;
  }>;

  // AIDEV-NOTE: DEV-only debugging. Must be safe to return to the client (no secrets).
  // Keep `cause` short and avoid dumping raw bodies containing SQL or tokens.
  debug?: {
    cause?    : string;
    backend?  : {
      path?     : string;
      method?   : string;
      scope?    : string[];
      status?   : number;
    };
  };
};

export type ActionResult<T> =
  | { success: true;  data: T;             meta: ActionMeta }
  | { success: false; error: ActionError;  meta: ActionMeta };
