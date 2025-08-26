// AIDEV-NOTE: Simple UUID v4 validator to guard dynamic route params

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return UUID_V4_REGEX.test(value);
}
