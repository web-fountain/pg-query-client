import type { TreeNode } from '@Redux/records/queryTree/types';

type OptionalTree = {
  getItemInstance?: (id: string) => unknown;
};

function toNodeIdList(children: TreeNode[] | null | undefined): string[] {
  if (!Array.isArray(children) || children.length === 0) return [];
  const ids: string[] = [];
  for (const child of children) {
    const id = String((child as any)?.nodeId ?? '');
    if (id) ids.push(id);
  }
  return ids;
}

export function computeChildrenIdsAfterInsert(baseIds: string[], insertedId: string, insertIndex: number): string[] {
  const nextIds = Array.isArray(baseIds) ? baseIds.map((x) => String(x)).filter(Boolean) : [];
  const id = String(insertedId || '');
  if (!id) return nextIds;

  // AIDEV-NOTE: Ensure uniqueness to avoid confusing HT's cache.
  const existingIndex = nextIds.indexOf(id);
  if (existingIndex >= 0) {
    nextIds.splice(existingIndex, 1);
  }

  const rawIndex = Number(insertIndex);
  const idx = Number.isFinite(rawIndex) ? Math.max(0, Math.min(nextIds.length, rawIndex)) : nextIds.length;
  nextIds.splice(idx, 0, id);
  return nextIds;
}

export function updateChildrenIdsCache(tree: OptionalTree, parentId: string, childrenIds: string[]): void {
  const pid = String(parentId || '');
  if (!pid) return;
  try {
    const parentItem = (tree as any)?.getItemInstance?.(pid);
    (parentItem as any)?.updateCachedChildrenIds?.(childrenIds);
  } catch {}
}

export function primeChildrenIdsCache(tree: OptionalTree, parentId: string, children: TreeNode[] | null | undefined): void {
  // AIDEV-NOTE: Prime childrenIds cache before expanding so HT doesn't schedule a background
  // asyncDataLoader fetch via setTimeout (which can race with local draft insertions).
  updateChildrenIdsCache(tree, parentId, toNodeIdList(children));
}
