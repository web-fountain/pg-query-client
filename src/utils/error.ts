// AIDEV-NOTE: Centralized error formatting to avoid printing [object Object]
export type AnyError = unknown;

export function formatError(err: AnyError): string {
  try {
    if (err == null) return 'Unknown error';

    // If it's already a string
    if (typeof err === 'string') return err;

    // If it's an Error or has message
    if (err instanceof Error) {
      return err.stack || err.message || String(err);
    }
    if (typeof (err as any).message === 'string') {
      const maybeStack = typeof (err as any).stack === 'string' ? (err as any).stack : undefined;
      return maybeStack || (err as any).message;
    }

    // If Response JSON error from server
    if (typeof err === 'object') {
      // Common API error shapes
      const e = err as Record<string, any>;
      if (typeof e.error === 'string') return e.error;
      if (typeof e.message === 'string') return e.message;
      if (Array.isArray(e.errors)) {
        try {
          return e.errors.map((x: any) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ');
        } catch {}
      }
      // Fallback to JSON stringification
      try {
        return JSON.stringify(err);
      } catch {
        return Object.prototype.toString.call(err);
      }
    }

    // Numbers, booleans, symbols, etc.
    return String(err);
  } catch {
    return 'Unformattable error';
  }
}
