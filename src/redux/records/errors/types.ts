import type { ActionError } from '@Errors/types';
import type { FieldError }  from '@Errors/fieldError';


export type ErrorEntry = {
  id            : string;
  actionType    : string;
  message       : string;
  fields?       : FieldError[];
  // Optional correlation to a structured server action error.
  // When present, prefer using `actionError.id` as the support/debug identifier.
  actionError?  : ActionError;
  meta?         : unknown;
  createdAt     : string;   // ISO 8601 (timestamptz)
};

export type ErrorsState = {
  byId: Record<string, ErrorEntry>;
  last: string | null;
};
