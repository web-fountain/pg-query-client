import type { QueryTreeRecord, TreeNode } from './types';

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
  DuplicateName   : 6,
  DragNotFolder   : 7,
  SelfParent      : 8,
  Cycle           : 9,
  MaxDepth        : 10
} as const;

export type MoveViolationCode = (typeof MoveViolationCode)[keyof typeof MoveViolationCode];

const MOVE_VIOLATION_LABEL: Record<number, string> = {
  [MoveViolationCode.Ok]              : 'ok',
  [MoveViolationCode.MissingNode]     : 'missing-node',
  [MoveViolationCode.MissingTarget]   : 'missing-target',
  [MoveViolationCode.DragNotFile]     : 'drag-not-file',
  [MoveViolationCode.TargetNotFolder] : 'target-not-folder',
  [MoveViolationCode.SameParent]      : 'same-parent',
  [MoveViolationCode.DuplicateName]   : 'duplicate-name',
  [MoveViolationCode.DragNotFolder]   : 'drag-not-folder',
  [MoveViolationCode.SelfParent]      : 'self-parent',
  [MoveViolationCode.Cycle]           : 'cycle',
  [MoveViolationCode.MaxDepth]        : 'max-depth'
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

// AIDEV-NOTE: Base validation for moving *folders* (folder → folder/root) without scanning descendants.
// Cycle and depth checks are layered on separately since they may require walking parent chains or scanning loaded subtrees.
export function getMoveViolationCodeBaseFolder(
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

  if (node.kind !== 'folder') return MoveViolationCode.DragNotFolder;
  if (!isRootTarget && dest.kind !== 'folder') return MoveViolationCode.TargetNotFolder;

  if (String(nodeId) === destId) return MoveViolationCode.SelfParent;

  const currentParentId = String((node as any).parentNodeId ?? QUERY_TREE_ROOT_ID);
  if (currentParentId === destId) {
    return MoveViolationCode.SameParent;
  }

  return MoveViolationCode.Ok;
}

export function getMoveViolationCodeBaseFolderFromNodes(
  dragged: TreeNode | undefined,
  dest: TreeNode | undefined
): MoveViolationCode {
  if (!dragged) return MoveViolationCode.MissingNode;
  if (!dest) return MoveViolationCode.MissingTarget;
  if (dragged.kind !== 'folder') return MoveViolationCode.DragNotFolder;
  if (dest.kind !== 'folder') return MoveViolationCode.TargetNotFolder;
  if (String((dragged as any).nodeId) === String((dest as any).nodeId)) return MoveViolationCode.SelfParent;
  if (String((dragged as any).parentNodeId ?? QUERY_TREE_ROOT_ID) === String((dest as any).nodeId)) {
    return MoveViolationCode.SameParent;
  }
  return MoveViolationCode.Ok;
}

// AIDEV-NOTE: Cycle detection for folder moves. Returns:
// - true  => cycle would be created (dropping into own descendant or self)
// - false => no cycle detected
// - null  => cannot know (missing ancestor data)
export function wouldFolderMoveCreateCycle(
  tree: QueryTreeRecord,
  folderNodeId: string,
  destParentId: string
): boolean | null {
  const dragId = String(folderNodeId);
  const destId = String(destParentId);
  if (!dragId || !destId) return null;
  if (destId === QUERY_TREE_ROOT_ID) return false;
  if (destId === dragId) return true;

  let curId = destId;
  // AIDEV-NOTE: Depth is capped by MAX_QUERY_TREE_DEPTH; keep a guard to avoid infinite loops in corrupted states.
  for (let i = 0; i < (MAX_QUERY_TREE_DEPTH + 2); i++) {
    if (curId === dragId) return true;
    const cur = tree.nodes?.[curId] as any;
    if (!cur) return null;
    const pid = String(cur.parentNodeId ?? '');
    if (!pid) return false;
    if (pid === QUERY_TREE_ROOT_ID) return false;
    curId = pid;
  }

  return null;
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

// AIDEV-NOTE: Folder-name uniqueness under a destination parent is per-kind. This checks *folders only*.
export function isDuplicateFolderLabelInParent(
  tree: QueryTreeRecord,
  destParentId: string,
  normalizedFolderLabel: string,
  excludeNodeId?: string
): boolean | null {
  const ids = tree.childrenByParentId?.[String(destParentId) as any];
  if (ids === undefined) return null;
  if (!Array.isArray(ids)) return false;

  for (const cid of ids) {
    const id = String(cid);
    if (excludeNodeId && id === String(excludeNodeId)) continue;
    const n = tree.nodes?.[id] as TreeNode | undefined;
    if (!n || n.kind !== 'folder') continue;
    const nLabel = normalizeLabelForUniqueness(String((n as any).label ?? ''));
    if (nLabel === normalizedFolderLabel) return true;
  }

  return false;
}

export type LoadedFolderSubtreeScan = {
  // Max `level` observed in the loaded subtree (includes the root folder).
  maxLevel     : number;
  // Whether the subtree scan was complete (all descendant folders had loaded children arrays).
  complete     : boolean;
  // Descendant node ids that were visited (excludes the root folder id).
  descendantIds: string[];
};

// AIDEV-NOTE: Scan the *loaded* subtree under a folder using `childrenByParentId`.
// This is designed for thunks (not hot-path hover checks). If a folder's children are not loaded,
// `complete` will be false and `maxLevel` is a lower bound.
export function scanLoadedFolderSubtree(
  tree: QueryTreeRecord,
  folderNodeId: string
): LoadedFolderSubtreeScan {
  const root = tree.nodes?.[String(folderNodeId)] as any;
  const rootLevel = Number(root?.level ?? 0);
  let maxLevel = Number.isFinite(rootLevel) ? rootLevel : 0;
  let complete = true;
  const descendantIds: string[] = [];

  const stack: string[] = [String(folderNodeId)];
  const MAX_SCAN_NODES = 50000;

  while (stack.length > 0) {
    const fid = stack.pop() as string;
    const ids = tree.childrenByParentId?.[fid as any];
    if (ids === undefined) {
      complete = false;
      continue;
    }
    if (!Array.isArray(ids) || ids.length === 0) continue;

    for (const cid of ids) {
      const id = String(cid);
      descendantIds.push(id);
      if (descendantIds.length > MAX_SCAN_NODES) {
        complete = false;
        stack.length = 0;
        break;
      }

      const n = tree.nodes?.[id] as any;
      if (!n) {
        complete = false;
        continue;
      }

      const lvl = Number(n.level ?? 0);
      if (Number.isFinite(lvl) && lvl > maxLevel) maxLevel = lvl;

      if (n.kind === 'folder') {
        stack.push(id);
      }
    }
  }

  return { maxLevel, complete, descendantIds };
}
