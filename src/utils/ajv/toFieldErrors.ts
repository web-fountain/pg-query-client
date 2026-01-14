import type { ErrorObject } from 'ajv';
import type { FieldError }  from '@Errors/fieldError';


// AIDEV-NOTE: Normalize AJV errors into the app's serializable FieldError shape.
export function toFieldErrors(errors: ErrorObject[] | null | undefined): FieldError[] {
  return (errors || []).map((e) => {
    const missing = (e.params as Record<string, unknown> | undefined)?.['missingProperty'] as string | undefined;
    const path = e.instancePath || (missing ? `/${missing}` : '');
    return { path, message: e.message || 'Invalid value' };
  });
}
