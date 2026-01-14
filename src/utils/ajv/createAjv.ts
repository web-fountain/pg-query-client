import type { Options } from 'ajv';
import Ajv              from 'ajv';
import addErrors        from 'ajv-errors';
import addFormats       from 'ajv-formats';


// AIDEV-NOTE: We intentionally use a factory (not a singleton) so each validation
// module can compile schemas without risking $id collisions or dev/HMR cross-talk.
export function createAjv(options: Options = {}): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    ...options
  });

  addFormats(ajv);
  addErrors(ajv);

  return ajv;
}
