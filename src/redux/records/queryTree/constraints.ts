import type { QueryTreeRecord, TreeNode } from './types';
import { fsSortKeyEn }                    from '@Utils/collation';

// AIDEV-NOTE: Centralized QueryTree constraints. This module is intentionally framework-agnostic:
// - Pure functions (no Redux/React imports)
// - Small, allocation-light helpers suitable for hot paths like DnD `canDrop`
// - Shared constants to remove duplicated "magic numbers" across UI and adapters

// AIDEV-NOTE: Headless-tree meta `level` is 0-based; aria-level is 1-based.
// To block folders at aria-level=4, disallow folder semantics at meta level >= 3.
export const MAX_FOLDER_META_LEVEL = 3;

// AIDEV-NOTE: Server-enforced maximum depth for the saved QueryTree. Root children are level 1.
export const MAX_QUERY_TREE_DEPTH = 16;

// AIDEV-NOTE: Saved QueryTree section root id. This root is synthetic (not always present in `nodes`)
// but is a valid folder target for moves (e.g., moving a file back out of a folder).
export const QUERY_TREE_ROOT_ID = 'queries';

// AIDEV-NOTE: Backend defaults file ext to 'sql' when omitted. Keep the default centralized
// so client uniqueness checks and draft nodes are consistent.
export const DEFAULT_QUERY_FILE_EXT = 'sql';

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

// AIDEV-NOTE: Normalization for uniqueness checks. Do NOT reuse sortKey formatting here:
// - Sorting wants numeric equivalence (e.g., "1" == "01") for nicer ordering.
// - Uniqueness should treat them as distinct names (filesystem-like semantics).
export function normalizeLabelForUniqueness(label: string): string {
  return label.trim().toLowerCase();
}

export function normalizeExtForUniqueness(ext: string | null | undefined): string {
  const raw = String(ext ?? DEFAULT_QUERY_FILE_EXT).trim().toLowerCase();
  if (!raw) return DEFAULT_QUERY_FILE_EXT;
  if (raw.startsWith('.')) return raw.slice(1) || DEFAULT_QUERY_FILE_EXT;
  return raw;
}

// AIDEV-NOTE: Normalized uniqueness key for saved QueryTree *files* (per-parent, per-kind).
// Uses a delimiter unlikely to occur in filenames to avoid collisions.
export function normalizeFileKeyForUniqueness(label: string, ext: string | null | undefined): string {
  return `${normalizeLabelForUniqueness(label)}\u0000${normalizeExtForUniqueness(ext)}`;
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

  const destId = String(destParentId);
  const dest = tree.nodes?.[destId];
  const isRootTarget = destId === QUERY_TREE_ROOT_ID && !dest;
  if (!dest && !isRootTarget) return MoveViolationCode.MissingTarget;

  if (node.kind !== 'file') return MoveViolationCode.DragNotFile;
  if (!isRootTarget && dest.kind !== 'folder') return MoveViolationCode.TargetNotFolder;

  if (String((node as any).parentNodeId) === destId) {
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
  normalizedFileKey: string,
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
    const nKey = normalizeFileKeyForUniqueness(
      String((n as any).label ?? ''),
      (n as any).ext
    );
    if (nKey === normalizedFileKey) return true;
  }

  return false;
}
