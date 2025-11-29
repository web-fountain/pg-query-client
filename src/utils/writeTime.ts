// Keep pure and reusable. See dataQuery slice for usage examples.

type AnyRecord = Record<string, any>;

function mergeAllowedChanges(prev: AnyRecord, changes: AnyRecord, allowedKeys: readonly string[]): AnyRecord {
  const next: AnyRecord = { ...prev };
  for (const key of allowedKeys) {
    if (Object.hasOwn(changes, key)) {
      next[key] = changes[key];
    }
  }
  // AIDEV-NOTE: Caller may further prune keys equal to persisted to avoid no-op unsaved.
  return next;
}

function buildUpdatePayload<K extends string, T extends string, C extends Record<string, unknown>>(idKey: K, idValue: T, changes: C): { update: { [P in K]: T } & C } {
  const withId = { [idKey]: idValue, ...changes } as { [P in K]: T } & C;
  return { update: withId };
}

function isEmptyObject(obj?: AnyRecord | null): boolean {
  if (!obj) return true;
  for (const _ in obj) return false;
  return true;
}


export { mergeAllowedChanges, buildUpdatePayload, isEmptyObject };
