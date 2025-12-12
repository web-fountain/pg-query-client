import type { ActionError } from '@Errors/types';
import type { ErrorEntry }  from './types';


// Converts a structured ActionError (from a server action) into a Redux ErrorEntry payload.
// The thunk decides whether to dispatch this, depending on UX.
export function errorEntryFromActionError(args: { actionType: string; error: ActionError; }): Omit<ErrorEntry, 'id' | 'createdAt'> {
  return {
    actionType  : args.actionType,
    message     : args.error.message,
    fields      : args.error.fields,
    actionError : args.error
  };
}
