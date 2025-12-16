import type { QueryTreeRecord, TreeNode } from './types';
import { fsSortKeyEn }                    from '@Utils/collation';

// AIDEV-NOTE: Centralized QueryTree constraints. This module is intentionally framework-agnostic:
// - Pure functions (no Redux/React imports)
// - Small, allocation-light helpers suitable for hot paths like DnD `canDrop`
// - Shared constants to remove duplicated "magic numbers" across UI and adapters

// AIDEV-NOTE: Headless-tree meta `level` is 0-based; aria-level is 1-based.
// To block folders at aria-level=4, disallow folder semantics at meta level >= 3.
export const MAX_FOLDER_META_LEVEL = 3;

// AIDEV-NOTE: We avoid `const enum` because this repo uses `isolatedModules: true`.
// Use a frozen value object + derived union type for fast comparisons and nice autocompletion.
export const MoveViolationCode = {
  Ok              : 0,
  MissingNode     : 1,
  MissingTarget   : 2,
  DragNotFile     : 3,
  TargetNotFolder : 4,
  SameParent      : 5,
  DuplicateName   : 6
} as const;

export type MoveViolationCode = (typeof MoveViolationCode)[keyof typeof MoveViolationCode];

const MOVE_VIOLATION_LABEL: Record<number, string> = {
  [MoveViolationCode.Ok]              : 'ok',
  [MoveViolationCode.MissingNode]     : 'missing-node',
  [MoveViolationCode.MissingTarget]   : 'missing-target',
  [MoveViolationCode.DragNotFile]     : 'drag-not-file',
  [MoveViolationCode.TargetNotFolder] : 'target-not-folder',
  [MoveViolationCode.SameParent]      : 'same-parent',
  [MoveViolationCode.DuplicateName]   : 'duplicate-name'
};

export function getMoveViolationLabel(code: MoveViolationCode): string {
  return MOVE_VIOLATION_LABEL[code] || 'unknown';
}

export function canTreatMetaLevelAsFolder(level: number): boolean {
  return level < MAX_FOLDER_META_LEVEL;
}

export function canCreateFolderChildAtParentMetaLevel(parentLevel: number): boolean {
  // Child meta level is parent + 1; folders are allowed only while < MAX_FOLDER_META_LEVEL.
  return (parentLevel + 1) < MAX_FOLDER_META_LEVEL;
}

// AIDEV-NOTE: Normalization for uniqueness checks. We prefer fsSortKeyEn because it mirrors
// backend-friendly normalization (lowercase + zero-padded digit runs) and avoids locale issues.
export function normalizeLabelForUniqueness(label: string): string {
  return fsSortKeyEn(label.trim());
}

// AIDEV-NOTE: Fast base move validation without scanning destination siblings.
// This is safe for hot paths; callers can optionally add duplicate checks.
export function getMoveViolationCodeBase(
  tree: QueryTreeRecord,
  nodeId: string,
  destParentId: string
): MoveViolationCode {
  const node = tree.nodes?.[String(nodeId)];
  if (!node) return MoveViolationCode.MissingNode;

  const dest = tree.nodes?.[String(destParentId)];
  if (!dest) return MoveViolationCode.MissingTarget;

  if (node.kind !== 'file') return MoveViolationCode.DragNotFile;
  if (dest.kind !== 'folder') return MoveViolationCode.TargetNotFolder;

  if (String((node as any).parentNodeId) === String(destParentId)) {
    return MoveViolationCode.SameParent;
  }

  return MoveViolationCode.Ok;
}

// AIDEV-NOTE: Variant for call sites that already have node payloads (e.g., headless-tree
// item instances that may be loaded outside Redux). Prefer this in UI hot paths.
export function getMoveViolationCodeBaseFromNodes(
  dragged: TreeNode | undefined,
  dest: TreeNode | undefined
): MoveViolationCode {
  if (!dragged) return MoveViolationCode.MissingNode;
  if (!dest) return MoveViolationCode.MissingTarget;
  if (dragged.kind !== 'file') return MoveViolationCode.DragNotFile;
  if (dest.kind !== 'folder') return MoveViolationCode.TargetNotFolder;
  if (String((dragged as any).parentNodeId) === String((dest as any).nodeId)) {
    return MoveViolationCode.SameParent;
  }
  return MoveViolationCode.Ok;
}

// AIDEV-NOTE: Tri-state result for duplicate checks:
// - true  => duplicate exists
// - false => no duplicate
// - null  => cannot know (children not loaded)
export function isDuplicateNameInParent(
  tree: QueryTreeRecord,
  destParentId: string,
  normalizedLabel: string,
  excludeNodeId?: string
): boolean | null {
  const ids = tree.childrenByParentId?.[String(destParentId) as any];
  if (ids === undefined) return null;
  if (!Array.isArray(ids)) return false;

  for (const cid of ids) {
    const id = String(cid);
    if (excludeNodeId && id === String(excludeNodeId)) continue;
    const n = tree.nodes?.[id] as TreeNode | undefined;
    if (!n || n.kind !== 'file') continue;
    const nLabel = normalizeLabelForUniqueness(String((n as any).label ?? ''));
    if (nLabel === normalizedLabel) return true;
  }

  return false;
}
