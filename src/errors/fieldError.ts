// Shared, serializable field-level error shape used by ActionError and Redux errors.
// Keep it minimal so it can cross server/client boundaries.
export type FieldError = {
  path    : string;
  message : string;
};
