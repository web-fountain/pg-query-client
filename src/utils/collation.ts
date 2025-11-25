// AIDEV-NOTE: Memoized collator approximating fs_numeric_en (ICU: en-u-kn)
// Numeric-aware, English collation with accent sensitivity for stable, human-friendly ordering.

let memoizedFsNumericEn: Intl.Collator | null = null;

export function getFsNumericEnCollator(): Intl.Collator {
  if (memoizedFsNumericEn) return memoizedFsNumericEn;
  // AIDEV-NOTE: numeric=true enables digit-substring numeric comparison (e.g., v2 < v10)
  // sensitivity='accent' keeps case-insensitive, diacritics-sensitive behavior similar to ICU defaults
  memoizedFsNumericEn = new Intl.Collator('en-u-kn', {
    numeric: true,
    sensitivity: 'accent',
    usage: 'sort'
  });
  return memoizedFsNumericEn;
}

// AIDEV-NOTE: Backend standardizes on sortKey. Provide a helper for lexicographic comparison
// so call sites can keep all collation-related logic centralized here.

export function compareSortKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
