'use client';

import type { TreeNode }                  from '@Redux/records/queryTree/types';
import {
  useCallback, useEffect, useEffectEvent,
  useRef
}                                         from 'react';

import { useReduxDispatch }               from '@Redux/storeHooks';
import { getQueryTreeNodeChildrenThunk }  from '@Redux/records/queryTree/thunks';
import {
  getMoveViolationCodeBaseFromNodes,
  getMoveViolationCodeBaseFolderFromNodes,
  getMoveViolationLabel,
  MAX_QUERY_TREE_DEPTH,
  normalizeFileKeyForUniqueness,
  normalizeLabelForUniqueness,
  MoveViolationCode
}                                         from '@Redux/records/queryTree/constraints';
import { logClientJson }                  from '@Observability/client';


type Args = {
  rootId                : string;
  label                 : string;
  queryTreeRef          : React.RefObject<any>;
  pendingInvalidations  : unknown;
  onDropMove            : (dragId: string, dropTargetId: string) => void | Promise<void>;
};

type Result = {
  canDrag         : (items: any[]) => boolean;
  canDrop         : (items: any[], target: any) => boolean;
  onDrop          : (items: any[], target: any) => void | Promise<void>;
  openOnDropDelay : number;
};

function useQueryTreeDnD({ rootId, label, queryTreeRef, pendingInvalidations, onDropMove }: Args): Result {
  const dispatch = useReduxDispatch();

  // AIDEV-NOTE: DnD constraint runtime caches. These keep `canDrop` fast and let us prefetch
  // missing children once per drag session so duplicate checks become accurate (keyed by label+ext).
  const activeDragIdRef                     = useRef<string | null>(null);
  const prefetchedFoldersRef                = useRef<Set<string>>(new Set());
  const inFlightPrefetchRef                 = useRef<Set<string>>(new Set());
  const prefetchedChildrenFileKeysRef       = useRef<Map<string, Set<string>>>(new Map());
  const cachedChildrenFileKeysRef           = useRef<Map<string, Set<string>>>(new Map());
  const prefetchedChildrenFolderLabelsRef   = useRef<Map<string, Set<string>>>(new Map());
  const cachedChildrenFolderLabelsRef       = useRef<Map<string, Set<string>>>(new Map());
  const prefetchedChildrenFolderChildIdsRef = useRef<Map<string, string[]>>(new Map());
  const prefetchedChildrenMaxLevelRef       = useRef<Map<string, number>>(new Map());
  const loggedConstraintKeysRef             = useRef<Set<string>>(new Set());
  const prefetchQueueRef                    = useRef<string[]>([]);
  const prefetchTimerRef                    = useRef<number | null>(null);
  const prefetchLastTsRef                   = useRef<number>(0);
  const PREFETCH_THROTTLE_MS                = 120;
  const FOLDER_SUBTREE_PREFETCH_MAX         = 28;

  // AIDEV-NOTE: Folder-subtree depth prefetch state (only active while dragging a folder).
  // We gradually fetch missing descendant folder children lists to improve max-depth validation UX.
  const activeFolderDragIdRef           = useRef<string | null>(null);
  const folderSubtreeKnownMaxLevelRef   = useRef<number>(0);
  const folderSubtreeRootLevelRef       = useRef<number>(0);
  const folderSubtreeKnownFoldersRef    = useRef<Set<string>>(new Set());
  const folderSubtreeExploredFoldersRef = useRef<Set<string>>(new Set());
  const folderSubtreeMissingChildrenRef = useRef<Set<string>>(new Set());
  const folderSubtreeExploreQueueRef    = useRef<string[]>([]);
  const folderSubtreePrefetchBudgetRef  = useRef<number>(0);

  const logConstraintOnce = useCallback((key: string, payload: Record<string, unknown>) => {
    try {
      if (loggedConstraintKeysRef.current.has(key)) return;
      loggedConstraintKeysRef.current.add(key);
      logClientJson('debug', () => payload);
    } catch {}
  }, []);

  // AIDEV-NOTE: Clear per-drag caches on drag end/drop to avoid memory growth across sessions.
  const clear = useEffectEvent(() => {
    activeDragIdRef.current                 = null;
    activeFolderDragIdRef.current           = null;
    prefetchQueueRef.current                = [];
    prefetchLastTsRef.current               = 0;
    folderSubtreeKnownMaxLevelRef.current   = 0;
    folderSubtreeRootLevelRef.current       = 0;
    folderSubtreeExploreQueueRef.current    = [];
    folderSubtreePrefetchBudgetRef.current  = 0;

    prefetchedFoldersRef.current.clear();
    inFlightPrefetchRef.current.clear();
    prefetchedChildrenFileKeysRef.current.clear();
    cachedChildrenFileKeysRef.current.clear();
    prefetchedChildrenFolderLabelsRef.current.clear();
    cachedChildrenFolderLabelsRef.current.clear();
    prefetchedChildrenFolderChildIdsRef.current.clear();
    prefetchedChildrenMaxLevelRef.current.clear();
    loggedConstraintKeysRef.current.clear();
    folderSubtreeKnownFoldersRef.current.clear();
    folderSubtreeExploredFoldersRef.current.clear();
    folderSubtreeMissingChildrenRef.current.clear();

    if (prefetchTimerRef.current != null) {
      try { window.clearTimeout(prefetchTimerRef.current); } catch {}
      prefetchTimerRef.current = null;
    }
  });

  useEffect(() => {
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, [clear]);

  // AIDEV-NOTE: If the Redux tree reports structural/label invalidations, drop any prefetch caches.
  // This keeps duplicate checks conservative when data has changed underneath us.
  useEffect(() => {
    const inv = pendingInvalidations as any;
    if (!inv) return;
    if ((inv.items?.length ?? 0) > 0 || (inv.parents?.length ?? 0) > 0) {
      prefetchedChildrenFileKeysRef.current.clear();
      cachedChildrenFileKeysRef.current.clear();
      prefetchedChildrenFolderLabelsRef.current.clear();
      cachedChildrenFolderLabelsRef.current.clear();
      prefetchedChildrenFolderChildIdsRef.current.clear();
      prefetchedChildrenMaxLevelRef.current.clear();
    }
  }, [pendingInvalidations]);

  const enqueuePrefetchChildren = useCallback((folderId: string, options?: { force?: boolean }) => {
    const fid = String(folderId);
    if (!fid) return;
    // AIDEV-NOTE: Only prefetch if children are not already known in Redux and not already prefetched.
    const current = queryTreeRef.current;
    const alreadyKnown = current?.childrenByParentId?.[fid as any] !== undefined;
    if (alreadyKnown && !options?.force) return;
    if (prefetchedChildrenFileKeysRef.current.has(fid)) return;
    if (prefetchedFoldersRef.current.has(fid)) return;

    prefetchedFoldersRef.current.add(fid);
    prefetchQueueRef.current.push(fid);
    schedulePrefetchDrain();
  }, [queryTreeRef]);

  function schedulePrefetchDrain(): void {
    if (prefetchTimerRef.current != null) return;
    if (prefetchQueueRef.current.length === 0) return;

    const elapsed = Date.now() - prefetchLastTsRef.current;
    const wait = elapsed >= PREFETCH_THROTTLE_MS ? 0 : (PREFETCH_THROTTLE_MS - elapsed);

    prefetchTimerRef.current = window.setTimeout(() => {
      prefetchTimerRef.current = null;

      const folderId = prefetchQueueRef.current.shift();
      if (!folderId) return;

      prefetchLastTsRef.current = Date.now();
      if (inFlightPrefetchRef.current.has(folderId)) {
        schedulePrefetchDrain();
        return;
      }

      inFlightPrefetchRef.current.add(folderId);
      dispatch(getQueryTreeNodeChildrenThunk({ nodeId: folderId }))
        .unwrap()
        .then((children: TreeNode[]) => {
          const fileKeys = new Set<string>();
          const folderLabels = new Set<string>();
          const folderChildIds: string[] = [];
          let maxLevel = 0;

          for (const child of (children || [])) {
            if (!child) continue;
            const kind = (child as any).kind;

            const lvl = Number((child as any).level ?? 0);
            if (Number.isFinite(lvl) && lvl > maxLevel) maxLevel = lvl;

            if (kind === 'file') {
              fileKeys.add(normalizeFileKeyForUniqueness(
                String((child as any).label ?? ''),
                (child as any).ext
              ));
              continue;
            }

            if (kind === 'folder') {
              folderLabels.add(normalizeLabelForUniqueness(String((child as any).label ?? '')));
              folderChildIds.push(String((child as any).nodeId ?? ''));
            }
          }

          prefetchedChildrenFileKeysRef.current.set(folderId, fileKeys);
          prefetchedChildrenFolderLabelsRef.current.set(folderId, folderLabels);
          prefetchedChildrenFolderChildIdsRef.current.set(folderId, folderChildIds.filter(Boolean));
          prefetchedChildrenMaxLevelRef.current.set(folderId, maxLevel);

          // AIDEV-NOTE: If we're currently dragging a folder, a completed prefetch may unlock deeper
          // subtree depth validation. Defer expensive scans to a small helper to keep the hot path lean.
          try {
            if (activeFolderDragIdRef.current && folderSubtreeKnownFoldersRef.current.has(folderId)) {
              folderSubtreeExploreQueueRef.current.push(folderId);
              drainFolderSubtreeExplore();
            }
          } catch {}
        })
        .catch(() => {})
        .finally(() => {
          inFlightPrefetchRef.current.delete(folderId);
        });

      schedulePrefetchDrain();
    }, wait);
  }

  const ensureChildrenUniqCaches = useCallback((fid: string, excludeNodeId: string) => {
    const current = queryTreeRef.current;
    const ids = current?.childrenByParentId?.[fid as any];
    if (ids === undefined) return null;

    const fileSet = new Set<string>();
    const folderSet = new Set<string>();
    if (!Array.isArray(ids) || ids.length === 0) {
      cachedChildrenFileKeysRef.current.set(fid, fileSet);
      cachedChildrenFolderLabelsRef.current.set(fid, folderSet);
      return { fileSet, folderSet };
    }

    const nodes = current?.nodes || {};
    for (const cid of ids) {
      const id = String(cid);
      if (excludeNodeId && id === excludeNodeId) continue;
      const n = nodes[id] as any;
      if (!n) continue;
      if (n.kind === 'file') {
        fileSet.add(normalizeFileKeyForUniqueness(String(n.label ?? ''), n.ext));
      } else if (n.kind === 'folder') {
        folderSet.add(normalizeLabelForUniqueness(String(n.label ?? '')));
      }
    }

    cachedChildrenFileKeysRef.current.set(fid, fileSet);
    cachedChildrenFolderLabelsRef.current.set(fid, folderSet);
    return { fileSet, folderSet };
  }, [queryTreeRef]);

  const getDuplicateFileStatus = useCallback((folderId: string, normalizedFileKey: string, excludeNodeId: string): boolean | null => {
    const fid = String(folderId);
    if (!fid) return null;

    const cached = cachedChildrenFileKeysRef.current.get(fid);
    if (cached) return cached.has(normalizedFileKey);

    const current = queryTreeRef.current;
    const ids = current?.childrenByParentId?.[fid as any];
    if (ids === undefined) {
      const prefetched = prefetchedChildrenFileKeysRef.current.get(fid);
      if (prefetched) return prefetched.has(normalizedFileKey);
      return null;
    }

    const built = ensureChildrenUniqCaches(fid, excludeNodeId);
    return (built?.fileSet ?? cachedChildrenFileKeysRef.current.get(fid) ?? new Set<string>()).has(normalizedFileKey);
  }, [ensureChildrenUniqCaches, queryTreeRef]);

  const getDuplicateFolderStatus = useCallback((folderId: string, normalizedFolderLabel: string, excludeNodeId: string): boolean | null => {
    const fid = String(folderId);
    if (!fid) return null;

    const cached = cachedChildrenFolderLabelsRef.current.get(fid);
    if (cached) return cached.has(normalizedFolderLabel);

    const current = queryTreeRef.current;
    const ids = current?.childrenByParentId?.[fid as any];
    if (ids === undefined) {
      const prefetched = prefetchedChildrenFolderLabelsRef.current.get(fid);
      if (prefetched) return prefetched.has(normalizedFolderLabel);
      return null;
    }

    const built = ensureChildrenUniqCaches(fid, excludeNodeId);
    return (built?.folderSet ?? cachedChildrenFolderLabelsRef.current.get(fid) ?? new Set<string>()).has(normalizedFolderLabel);
  }, [ensureChildrenUniqCaches, queryTreeRef]);

  function drainFolderSubtreeExplore(): void {
    const rootDragId = activeFolderDragIdRef.current;
    if (!rootDragId) return;

    const budget = folderSubtreePrefetchBudgetRef.current;
    if (budget <= 0 && folderSubtreeExploreQueueRef.current.length === 0) return;

    const current = queryTreeRef.current;

    // Drain a bounded number of nodes per call to keep this work off the hot path.
    const MAX_WORK = 40;
    let work = 0;

    while (folderSubtreeExploreQueueRef.current.length > 0 && work < MAX_WORK) {
      work++;
      const fid = String(folderSubtreeExploreQueueRef.current.shift() ?? '');
      if (!fid) continue;
      if (folderSubtreeExploredFoldersRef.current.has(fid)) continue;
      folderSubtreeExploredFoldersRef.current.add(fid);

      // Prefer prefetched children (authoritative for this session) over Redux.
      const prefetchedMax = prefetchedChildrenMaxLevelRef.current.get(fid);
      const prefetchedFolderChildren = prefetchedChildrenFolderChildIdsRef.current.get(fid);
      if (prefetchedMax != null) {
        const max = folderSubtreeKnownMaxLevelRef.current;
        if (prefetchedMax > max) folderSubtreeKnownMaxLevelRef.current = prefetchedMax;
      }
      if (Array.isArray(prefetchedFolderChildren)) {
        folderSubtreeMissingChildrenRef.current.delete(fid);
        for (const cid of prefetchedFolderChildren) {
          const childId = String(cid);
          if (!childId) continue;
          if (!folderSubtreeKnownFoldersRef.current.has(childId)) {
            folderSubtreeKnownFoldersRef.current.add(childId);
          }
          if (!folderSubtreeExploredFoldersRef.current.has(childId)) {
            folderSubtreeExploreQueueRef.current.push(childId);
          }
        }
        continue;
      }

      const ids = current?.childrenByParentId?.[fid as any];
      if (ids === undefined) {
        folderSubtreeMissingChildrenRef.current.add(fid);
        if (folderSubtreePrefetchBudgetRef.current > 0) {
          folderSubtreePrefetchBudgetRef.current = folderSubtreePrefetchBudgetRef.current - 1;
          enqueuePrefetchChildren(fid);
        }
        continue;
      }

      folderSubtreeMissingChildrenRef.current.delete(fid);
      if (!Array.isArray(ids) || ids.length === 0) continue;

      const nodes = current?.nodes || {};
      for (const cid of ids) {
        const id = String(cid);
        const n = nodes[id] as any;
        if (!n) {
          // AIDEV-NOTE: Children ids exist but node payload is missing; fetch authoritative children.
          folderSubtreeMissingChildrenRef.current.add(fid);
          if (folderSubtreePrefetchBudgetRef.current > 0) {
            folderSubtreePrefetchBudgetRef.current = folderSubtreePrefetchBudgetRef.current - 1;
            enqueuePrefetchChildren(fid, { force: true });
          }
          break;
        }

        const lvl = Number(n.level ?? 0);
        if (Number.isFinite(lvl) && lvl > folderSubtreeKnownMaxLevelRef.current) {
          folderSubtreeKnownMaxLevelRef.current = lvl;
        }

        if (n.kind === 'folder') {
          const childId = String(n.nodeId ?? id);
          folderSubtreeKnownFoldersRef.current.add(childId);
          if (!folderSubtreeExploredFoldersRef.current.has(childId)) {
            folderSubtreeExploreQueueRef.current.push(childId);
          }
        }
      }
    }
  }

  const canDrag = useCallback((items: any[]) => {
    if (!Array.isArray(items) || items.length !== 1) return false;
    const it = items[0];
    if (!it) return false;
    const id = it?.getId?.();
    if (!id) return false;
    if (String(id) === String(rootId)) return false;
    const data = it?.getItemData?.() as TreeNode | undefined;
    if (!data) return false;
    return data.kind === 'file' || data.kind === 'folder';
  }, [rootId]);

  const canDrop = useCallback((items: any[], target: any) => {
    if (!Array.isArray(items) || items.length !== 1) return false;
    const dragged = items[0];
    const targetItem = target?.item;
    if (!dragged || !targetItem) return false;

    const dragId = dragged?.getId?.();
    const dropTargetId = targetItem?.getId?.();
    if (!dragId || !dropTargetId) return false;

    // AIDEV-NOTE: Headless-tree provides `childIndex` targets for "between row" drops.
    // This is our UX hook for outdenting: dropping above `reports_01` should land in `reports_01`'s parent (root).
    const isBetweenRows =
      !!target
      && typeof target === 'object'
      && ('childIndex' in (target as any))
      && typeof (target as any).childIndex === 'number';

    // AIDEV-NOTE: Disallow cross-section moves (cannot drag between different section roots).
    try {
      const draggedRoot = dragged?.getTree?.()?.getRootItem?.()?.getId?.();
      const targetRoot = targetItem?.getTree?.()?.getRootItem?.()?.getId?.();
      if (draggedRoot && targetRoot && draggedRoot !== targetRoot) {
        logConstraintOnce(
          `${dragId}:${dropTargetId}:cross-section`,
          {
            event         : 'queryTree',
            phase         : 'constraint-violation',
            constraint    : 'cross-section',
            dragId        : String(dragId),
            dropTargetId  : String(dropTargetId),
            draggedRoot   : String(draggedRoot),
            targetRoot    : String(targetRoot)
          }
        );
        return false;
      }
    } catch {}

    // AIDEV-NOTE: Detect drag session changes and reset per-drag caches.
    if (activeDragIdRef.current !== String(dragId)) {
      activeDragIdRef.current                 = String(dragId);
      activeFolderDragIdRef.current           = null;
      folderSubtreeExploreQueueRef.current    = [];
      folderSubtreePrefetchBudgetRef.current  = 0;
      prefetchQueueRef.current                = [];
      prefetchLastTsRef.current               = 0;
      folderSubtreeKnownMaxLevelRef.current   = 0;
      folderSubtreeRootLevelRef.current       = 0;

      prefetchedFoldersRef.current.clear();
      prefetchedChildrenFileKeysRef.current.clear();
      cachedChildrenFileKeysRef.current.clear();
      prefetchedChildrenFolderLabelsRef.current.clear();
      cachedChildrenFolderLabelsRef.current.clear();
      prefetchedChildrenFolderChildIdsRef.current.clear();
      prefetchedChildrenMaxLevelRef.current.clear();
      loggedConstraintKeysRef.current.clear();
      folderSubtreeKnownFoldersRef.current.clear();
      folderSubtreeExploredFoldersRef.current.clear();
      folderSubtreeMissingChildrenRef.current.clear();

    }

    const draggedData = dragged.getItemData?.() as TreeNode | undefined;
    const targetData = targetItem.getItemData?.() as TreeNode | undefined;
    if (!draggedData) return false;

    // AIDEV-NOTE: The section root (`queries`) is a synthetic item that is not stored in Redux
    // `nodes`, so headless-tree may not have itemData for it. Treat it as a folder target so
    // users can drag files back out of folders into the root section.
    const isRootTarget = String(dropTargetId) === String(rootId);
    const effectiveTargetData = isRootTarget ? ({
      nodeId        : String(rootId),
      parentNodeId  : null,
      kind          : 'folder',
      label         : String(label ?? 'QUERIES'),
      sortKey       : '',
      mountId       : String(rootId),
      level         : 0
    } as unknown as TreeNode) : targetData;

    if (!effectiveTargetData) return false;

    // AIDEV-NOTE: Resolve destination parent id:
    // - Drop ON a folder row => destination is that folder
    // - Drop BETWEEN rows (above/below a row) => destination is the hovered row's parent folder
    const resolvedDropTargetId = (() => {
      if (!isBetweenRows) return String(dropTargetId);
      const pid = (targetData as any)?.parentNodeId;
      if (pid == null || pid === '') return String(rootId);
      return String(pid);
    })();

    // AIDEV-NOTE: Resolve destination folder node data for validation.
    const resolvedTargetData: TreeNode | undefined = (() => {
      if (String(resolvedDropTargetId) === String(rootId)) {
        return {
          nodeId        : String(rootId),
          parentNodeId  : null,
          kind          : 'folder',
          label         : String(label ?? 'QUERIES'),
          sortKey       : '',
          mountId       : String(rootId),
          level         : 0
        } as unknown as TreeNode;
      }
      if (!isBetweenRows) return effectiveTargetData;
      const candidate = queryTreeRef.current?.nodes?.[String(resolvedDropTargetId) as any] as TreeNode | undefined;
      return candidate ?? effectiveTargetData;
    })();

    if (!resolvedTargetData) return false;

    // AIDEV-NOTE: Dropping BETWEEN rows within the same parent would only reorder siblings,
    // which is not persisted (server sorts). Treat as a no-op and disallow.
    const draggedParentId = String((draggedData as any).parentNodeId ?? rootId);
    if (isBetweenRows && draggedParentId && draggedParentId === String(resolvedDropTargetId)) {
      return false;
    }

    // AIDEV-NOTE: If we're dragging a folder, initialize subtree exploration once per drag session.
    if (draggedData.kind === 'folder' && activeFolderDragIdRef.current !== String(dragId)) {
      activeFolderDragIdRef.current           = String(dragId);
      const rootLevel                         = Number((draggedData as any)?.level ?? 0);
      folderSubtreeRootLevelRef.current       = Number.isFinite(rootLevel) ? rootLevel : 0;
      folderSubtreeKnownMaxLevelRef.current   = folderSubtreeRootLevelRef.current;
      folderSubtreePrefetchBudgetRef.current  = FOLDER_SUBTREE_PREFETCH_MAX;
      folderSubtreeExploreQueueRef.current    = [];

      folderSubtreeKnownFoldersRef.current.clear();
      folderSubtreeExploredFoldersRef.current.clear();
      folderSubtreeMissingChildrenRef.current.clear();
      folderSubtreeKnownFoldersRef.current.add(String(dragId));
      folderSubtreeExploreQueueRef.current.push(String(dragId));
      drainFolderSubtreeExplore();
    }

    // Opportunistically advance subtree exploration work (bounded) so depth validation becomes
    // more accurate while the user hovers.
    if (draggedData.kind === 'folder') {
      drainFolderSubtreeExplore();
    }

    const base =
      draggedData.kind === 'folder'
        ? getMoveViolationCodeBaseFolderFromNodes(draggedData, resolvedTargetData)
        : getMoveViolationCodeBaseFromNodes(draggedData, resolvedTargetData);
    if (base !== MoveViolationCode.Ok) {
      logConstraintOnce(
        `${dragId}:${dropTargetId}:base-${base}`,
        {
          event                 : 'queryTree',
          phase                 : 'constraint-violation',
          constraint            : 'move-base',
          code                  : base,
          reason                : getMoveViolationLabel(base),
          dragId                : String(dragId),
          dropTargetId          : String(dropTargetId),
          resolvedDropTargetId  : String(resolvedDropTargetId),
          isBetweenRows         : isBetweenRows
        }
      );
      return false;
    }

    // AIDEV-NOTE: Folder moves must not create cycles (dropping into own descendant subtree).
    if (draggedData.kind === 'folder') {
      try {
        let curId = String(resolvedDropTargetId);
        let unknown = false;
        for (let i = 0; i < (MAX_QUERY_TREE_DEPTH + 2); i++) {
          if (!curId) break;
          if (curId === String(rootId)) break;
          if (curId === String(dragId)) {
            logConstraintOnce(
              `${dragId}:${dropTargetId}:cycle`,
              {
                event                 : 'queryTree',
                phase                 : 'constraint-violation',
                constraint            : 'cycle',
                dragId                : String(dragId),
                dropTargetId          : String(dropTargetId),
                resolvedDropTargetId  : String(resolvedDropTargetId)
              }
            );
            return false;
          }

          let cur: any = queryTreeRef.current?.nodes?.[curId as any] as any;
          if (!cur) {
            try {
              const t = (targetItem as any)?.getTree?.();
              const inst = (t as any)?.getItemInstance?.(curId);
              cur = inst?.getItemData?.();
            } catch {}
          }

          if (!cur) {
            unknown = true;
            break;
          }

          const pid = String(cur.parentNodeId ?? '');
          if (!pid || pid === String(rootId)) break;
          curId = pid;
        }

        // If we can't resolve the ancestor chain, rely on backend enforcement.
        if (unknown) {
          // no-op
        }
      } catch {}
    }

    // AIDEV-NOTE: Server-enforced max depth for moves (root children are level 1).
    try {
      const parentLevelRaw = (resolvedTargetData as any)?.level;
      const parentLevel = Number(parentLevelRaw);
      const newLevel = (Number.isFinite(parentLevel) ? parentLevel : 0) + 1;
      if (newLevel > MAX_QUERY_TREE_DEPTH) {
        logConstraintOnce(
          `${dragId}:${dropTargetId}:max-depth`,
          {
            event                 : 'queryTree',
            phase                 : 'constraint-violation',
            constraint            : 'max-depth',
            dragId                : String(dragId),
            dropTargetId          : String(dropTargetId),
            resolvedDropTargetId  : String(resolvedDropTargetId),
            newLevel              : newLevel,
            maxDepth              : MAX_QUERY_TREE_DEPTH
          }
        );
        return false;
      }

      // AIDEV-NOTE: Folder move depth check (best-effort). Use the deepest loaded/prefetched
      // descendant level we know about. If unknown, optimistically allow and keep prefetching.
      if (draggedData.kind === 'folder') {
        const oldLevel = folderSubtreeRootLevelRef.current;
        const knownMax = folderSubtreeKnownMaxLevelRef.current || oldLevel;
        const delta = newLevel - oldLevel;
        const newMax = knownMax + delta;
        if (newMax > MAX_QUERY_TREE_DEPTH) {
          logConstraintOnce(
            `${dragId}:${dropTargetId}:max-depth-subtree`,
            {
              event                 : 'queryTree',
              phase                 : 'constraint-violation',
              constraint            : 'max-depth-subtree',
              dragId                : String(dragId),
              dropTargetId          : String(dropTargetId),
              resolvedDropTargetId  : String(resolvedDropTargetId),
              newMaxLevel           : newMax,
              maxDepth              : MAX_QUERY_TREE_DEPTH,
              loadedComplete        : folderSubtreeMissingChildrenRef.current.size === 0
            }
          );
          return false;
        }
      }
    } catch {}

    // AIDEV-NOTE: Duplicate-name constraint (best-effort):
    // - If we can determine destination children (Redux or prefetched), disallow duplicates.
    // - If unknown, optimistically allow but schedule a one-time prefetch so subsequent hover checks
    //   become accurate before the user drops.
    const draggedLabel = String((draggedData as any)?.label ?? '').trim();
    if (!draggedLabel) {
      logConstraintOnce(
        `${dragId}:${dropTargetId}:empty-label`,
        {
          event         : 'queryTree',
          phase         : 'constraint-violation',
          constraint    : 'empty-label',
          dragId        : String(dragId),
          dropTargetId  : String(dropTargetId)
        }
      );
      return false;
    }

    if (draggedData.kind === 'file') {
      const draggedExt = (draggedData as any)?.ext;
      const normalized = normalizeFileKeyForUniqueness(draggedLabel, draggedExt);

      const dupe = getDuplicateFileStatus(String(resolvedDropTargetId), normalized, String(dragId));
      if (dupe === true) {
        logConstraintOnce(
          `${dragId}:${dropTargetId}:duplicate-name`,
          {
            event                 : 'queryTree',
            phase                 : 'constraint-violation',
            constraint            : 'duplicate-name',
            dragId                : String(dragId),
            dropTargetId          : String(dropTargetId),
            resolvedDropTargetId  : String(resolvedDropTargetId)
          }
        );
        return false;
      }
      if (dupe === null) {
        enqueuePrefetchChildren(String(resolvedDropTargetId));
      }
    } else if (draggedData.kind === 'folder') {
      const normalized = normalizeLabelForUniqueness(draggedLabel);
      const dupe = getDuplicateFolderStatus(String(resolvedDropTargetId), normalized, String(dragId));
      if (dupe === true) {
        logConstraintOnce(
          `${dragId}:${dropTargetId}:duplicate-folder`,
          {
            event                 : 'queryTree',
            phase                 : 'constraint-violation',
            constraint            : 'duplicate-folder',
            dragId                : String(dragId),
            dropTargetId          : String(dropTargetId),
            resolvedDropTargetId  : String(resolvedDropTargetId)
          }
        );
        return false;
      }
      if (dupe === null) {
        enqueuePrefetchChildren(String(resolvedDropTargetId));
      }
    }

    return true;
  }, [
    rootId,
    label,
    queryTreeRef,
    logConstraintOnce,
    dispatch,
    getDuplicateFileStatus,
    getDuplicateFolderStatus,
    enqueuePrefetchChildren
  ]);

  const onDrop = useCallback(async (items: any[], target: any) => {
    if (!Array.isArray(items) || items.length !== 1) return;
    const dragged       = items[0];
    const dragId        = dragged?.getId?.();
    const targetItem    = target?.item;
    const dropTargetId  = targetItem?.getId?.();
    if (!dragId || !dropTargetId) return;

    const draggedData = dragged.getItemData?.() as TreeNode | undefined;
    if (!draggedData) return;

    const isBetweenRows =
      !!target
      && typeof target === 'object'
      && ('childIndex' in (target as any))
      && typeof (target as any).childIndex === 'number';

    const targetData = targetItem.getItemData?.() as TreeNode | undefined;
    const resolvedDropTargetId = (() => {
      if (!isBetweenRows) return String(dropTargetId);
      const pid = (targetData as any)?.parentNodeId;
      if (pid == null || pid === '') return String(rootId);
      return String(pid);
    })();

    const draggedParentId = String((draggedData as any).parentNodeId ?? rootId);
    if (draggedParentId && draggedParentId === String(resolvedDropTargetId)) return;

    // AIDEV-NOTE: For saved QueryTree we treat allowed drops as "move into folder/root".
    await onDropMove(String(dragId), String(resolvedDropTargetId));
  }, [onDropMove, rootId]);

  return {
    canDrag,
    canDrop,
    onDrop,
    openOnDropDelay: 250
  };
}


export { useQueryTreeDnD };
