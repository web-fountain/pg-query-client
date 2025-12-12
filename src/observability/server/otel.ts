import 'server-only';

// OpenTelemetry integration will be added in phase 2.
// Intentionally no imports from @opentelemetry/* or @vercel/otel yet to avoid
// introducing dependency requirements before we implement tracing.

export function isOtelEnabled(): boolean {
  return (process.env.PGQC_OTEL_ENABLED || '').toLowerCase() === 'true';
}
