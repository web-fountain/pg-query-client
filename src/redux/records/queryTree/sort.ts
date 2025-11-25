import { getFsNumericEnCollator, compareSortKeys } from '@Utils/collation';


// AIDEV-NOTE: Minimal shape required for comparison; caller supplies resolved name
export type ComparableNode = {
  nodeId: string;
  kind: 'folder' | 'file';
  name: string;
  sortKey?: string;
};

// AIDEV-NOTE: Compare by folder-first, then name via fs_numeric_en, then nodeId
export function compareByName(a: ComparableNode, b: ComparableNode): number {
  if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
  const collator = getFsNumericEnCollator();
  const nameCmp = collator.compare(a.name, b.name);
  if (nameCmp !== 0) return nameCmp;
  if (a.nodeId === b.nodeId) return 0;
  return a.nodeId < b.nodeId ? -1 : 1;
}

// AIDEV-NOTE: Prefer sortKey when present (exact backend parity), else fallback to name comp
export function compareBySortKey(a: ComparableNode, b: ComparableNode): number {
  const aHas = !!a.sortKey;
  const bHas = !!b.sortKey;
  if (aHas && bHas) {
    const cmp = compareSortKeys(a.sortKey as string, b.sortKey as string);
    if (cmp !== 0) return cmp;
    return a.nodeId < b.nodeId ? -1 : (a.nodeId > b.nodeId ? 1 : 0);
  }
  return compareByName(a, b);
}

// AIDEV-NOTE: Generic binary search insertion index helper
export function findInsertIndex<T>(arr: T[], item: T, compare: (x: T, y: T) => number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const midVal = arr[mid];
    if (compare(item, midVal) <= 0) hi = mid; else lo = mid + 1;
  }
  return lo;
}

// AIDEV-NOTE: Convenience for ids array with external resolver
export function findInsertIndexIds(
  childrenIds: string[],
  newItem: ComparableNode,
  resolve: (id: string) => ComparableNode,
  compare: (a: ComparableNode, b: ComparableNode) => number
): number {
  let lo = 0;
  let hi = childrenIds.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const midItem = resolve(childrenIds[mid]);
    if (compare(newItem, midItem) <= 0) hi = mid; else lo = mid + 1;
  }
  return lo;
}
