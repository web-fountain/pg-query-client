'use client';

import type { QueryTreeRecord, TreeNode } from '@Redux/records/queryTree/types';
import type { UUIDv7 }                    from '@Types/primitives';

import {
  useCallback, useEffect, useMemo, useRef,
  useState
}                                         from 'react';
import { usePathname }                    from 'next/navigation';
import { useTree }                        from '@headless-tree/react';
import {
  asyncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature,
  dragAndDropFeature,
  expandAllFeature
}                                         from '@headless-tree/core';
import {
  useReduxSelector,
  useReduxDispatch
}                                         from '@Redux/storeHooks';
import { logClientJson }                  from '@Observability/client';
import {
  clearInvalidations,
  insertChildAtIndex,
  removeNode,
  selectQueryTree,
  upsertNode
}                                         from '@Redux/records/queryTree';
import {
  createQueryFolderThunk,
  createSavedQueryFileThunk,
  getQueryTreeNodeChildrenThunk
}                                         from '@Redux/records/queryTree/thunks';
import {
  DEFAULT_QUERY_FILE_EXT,
  getMoveViolationCodeBaseFromNodes,
  getMoveViolationCodeBaseFolderFromNodes,
  getMoveViolationLabel,
  MAX_QUERY_TREE_DEPTH,
  normalizeLabelForUniqueness,
  normalizeFileKeyForUniqueness,
  MoveViolationCode
}                                         from '@Redux/records/queryTree/constraints';
import {
  selectActiveTabId,
  selectTabIdByMountIdMap,
}                                         from '@Redux/records/tabbar';
import Icon                               from '@Components/Icons';

import { useTreeSectionState }            from '../hooks/useTreeSectionState';
import { useItemActions }                 from './hooks/useItemActions';
import { useExpandedFoldersState }        from './hooks/useExpandedFoldersState';
import { useQueriesRoute }                from '@QueriesProvider/QueriesRouteProvider';
import Row                                from './components/Row';
import Toolbar                            from './components/Toolbar';
import {
  createLoadingItemData as adapterCreateLoadingItemData,
  getItemName as adapterGetItemName,
  isItemFolder as adapterIsItemFolder
}                                         from './adapters/treeItemAdapter';
import {
  computeChildrenIdsAfterInsert,
  primeChildrenIdsCache,
  updateChildrenIdsCache
}                                         from './utils/headlessTreeCache';
import { generateUUIDv7 }                 from '@Utils/generateId';

import styles                             from './styles.module.css';


type DraftFolderState = {
  nodeId        : string;
  parentId      : string;
  name          : string;
  isSubmitting  : boolean;
};

type DraftFileState = {
  nodeId        : string;
  parentId      : string;
  dataQueryId   : UUIDv7;
  name          : string;
  isSubmitting  : boolean;
};

// AIDEV-NOTE: Outer wrapper to remount the hook-owned tree instance on Redux changes.
// Only remount on node count changes (add/delete). Renames and reordering are handled
// by surgical invalidation in QueriesTreeInner via pendingInvalidations.
function QueriesTree(props: { rootId: string; indent?: number; label?: string }) {
  const { isOpen, setIsOpen } = useTreeSectionState(props.rootId, true);
  const queryTree             = useReduxSelector(selectQueryTree);

  // AIDEV-NOTE: Draft folder UI state must live in the outer wrapper because
  // QueriesTreeInner is keyed by nodeCount and will remount on structural changes.
  const [draftFolder, setDraftFolder] = useState<DraftFolderState | null>(null);
  const [draftFile, setDraftFile]     = useState<DraftFileState | null>(null);

  // AIDEV-NOTE: Keep a stable key per section root so headless-tree preserves expanded
  // folder state across structural updates. Changes to the underlying Redux tree are
  // propagated via targeted invalidations in QueriesTreeInner instead of full remounts.
  const resetKey = props.rootId;

  return (
    <QueriesTreeInner
      key={resetKey}
      queryTree={queryTree}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      draftFolder={draftFolder}
      setDraftFolder={setDraftFolder}
      draftFile={draftFile}
      setDraftFile={setDraftFile}
      {...props}
    />
  );
}

function QueriesTreeInner(
{
    rootId,
    indent = 20,
    label = 'QUERIES',
    queryTree,
    isOpen,
    setIsOpen,
    draftFolder,
    setDraftFolder,
    draftFile,
    setDraftFile
  }:
  {
    rootId: string;
    indent?: number;
    label?: string;
    queryTree: QueryTreeRecord;
    isOpen: boolean;
    setIsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
    draftFolder: DraftFolderState | null;
    setDraftFolder: (v: DraftFolderState | null | ((prev: DraftFolderState | null) => DraftFolderState | null)) => void;
    draftFile: DraftFileState | null;
    setDraftFile: (v: DraftFileState | null | ((prev: DraftFileState | null) => DraftFileState | null)) => void;
  }
) {
  const { navigateToSaved, opspaceId } = useQueriesRoute();
  const dispatch            = useReduxDispatch();

  // AIDEV-NOTE: Ref ensures dataLoader always reads latest queryTree,
  // avoiding stale closure issues with useTree config.
  const queryTreeRef    = useRef(queryTree);
  const clickTimeoutRef = useRef<number | null>(null);
  queryTreeRef.current = queryTree;

  // AIDEV-NOTE: Lift tab lookups to parent — single subscription for all rows
  const activeTabId       = useReduxSelector(selectActiveTabId);
  const mountIdToTabIdMap = useReduxSelector(selectTabIdByMountIdMap);
  const pathname          = usePathname();
  // AIDEV-NOTE: Only treat rows as "active from tabbar" when the QueryWorkspace route is mounted.
  // On the opspace landing page (/opspace/{id}) we always want a click to navigate.
  const isOnQueriesRoute  = (pathname || '').split('/').filter(Boolean).includes('queries');

  // AIDEV-NOTE: Scope persisted expansion state by opspace + section root id to avoid cross-opspace bleed.
  const expandedScopeId   = `${opspaceId}:${rootId}`;
  const {
    expanded    : persistedExpandedFolders,
    setExpanded : setPersistedExpandedFolders
  } = useExpandedFoldersState(expandedScopeId);

  const expansionRestoreCompleteRef = useRef<boolean>(false);
  const lastExpandedScopeRef        = useRef<string | null>(null);
  if (lastExpandedScopeRef.current !== expandedScopeId) {
    lastExpandedScopeRef.current        = expandedScopeId;
    expansionRestoreCompleteRef.current = false;
  }

  // AIDEV-NOTE: DnD constraint runtime caches. These keep `canDrop` fast and let us prefetch
  // missing children once per drag session so duplicate checks become accurate (keyed by label+ext).
  const activeDragIdRef               = useRef<string | null>(null);
  const prefetchedFoldersRef          = useRef<Set<string>>(new Set());
  const inFlightPrefetchRef           = useRef<Set<string>>(new Set());
  const prefetchedChildrenFileKeysRef = useRef<Map<string, Set<string>>>(new Map());
  const cachedChildrenFileKeysRef     = useRef<Map<string, Set<string>>>(new Map());
  const prefetchedChildrenFolderLabelsRef = useRef<Map<string, Set<string>>>(new Map());
  const cachedChildrenFolderLabelsRef     = useRef<Map<string, Set<string>>>(new Map());
  const prefetchedChildrenFolderChildIdsRef = useRef<Map<string, string[]>>(new Map());
  const prefetchedChildrenMaxLevelRef       = useRef<Map<string, number>>(new Map());
  const loggedConstraintKeysRef       = useRef<Set<string>>(new Set());
  const prefetchQueueRef              = useRef<string[]>([]);
  const prefetchTimerRef              = useRef<number | null>(null);
  const prefetchLastTsRef             = useRef<number>(0);
  const PREFETCH_THROTTLE_MS          = 120;
  const FOLDER_SUBTREE_PREFETCH_MAX   = 28;

  // AIDEV-NOTE: Folder-subtree depth prefetch state (only active while dragging a folder).
  // We gradually fetch missing descendant folder children lists to improve max-depth validation UX.
  const activeFolderDragIdRef            = useRef<string | null>(null);
  const folderSubtreeKnownMaxLevelRef    = useRef<number>(0);
  const folderSubtreeRootLevelRef        = useRef<number>(0);
  const folderSubtreeKnownFoldersRef     = useRef<Set<string>>(new Set());
  const folderSubtreeExploredFoldersRef  = useRef<Set<string>>(new Set());
  const folderSubtreeMissingChildrenRef  = useRef<Set<string>>(new Set());
  const folderSubtreeExploreQueueRef     = useRef<string[]>([]);
  const folderSubtreePrefetchBudgetRef   = useRef<number>(0);

  // AIDEV-NOTE: Clear per-drag caches on drag end/drop to avoid memory growth across sessions.
  useEffect(() => {
    const clear = () => {
      activeDragIdRef.current = null;
      activeFolderDragIdRef.current = null;
      prefetchedFoldersRef.current.clear();
      inFlightPrefetchRef.current.clear();
      prefetchedChildrenFileKeysRef.current.clear();
      cachedChildrenFileKeysRef.current.clear();
      prefetchedChildrenFolderLabelsRef.current.clear();
      cachedChildrenFolderLabelsRef.current.clear();
      prefetchedChildrenFolderChildIdsRef.current.clear();
      prefetchedChildrenMaxLevelRef.current.clear();
      loggedConstraintKeysRef.current.clear();
      prefetchQueueRef.current = [];
      prefetchLastTsRef.current = 0;
      folderSubtreeKnownMaxLevelRef.current = 0;
      folderSubtreeRootLevelRef.current = 0;
      folderSubtreeKnownFoldersRef.current.clear();
      folderSubtreeExploredFoldersRef.current.clear();
      folderSubtreeMissingChildrenRef.current.clear();
      folderSubtreeExploreQueueRef.current = [];
      folderSubtreePrefetchBudgetRef.current = 0;
      if (prefetchTimerRef.current != null) {
        try { window.clearTimeout(prefetchTimerRef.current); } catch {}
        prefetchTimerRef.current = null;
      }
    };

    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);

  // AIDEV-NOTE: If the Redux tree reports structural/label invalidations, drop any prefetch caches.
  // This keeps duplicate checks conservative when data has changed underneath us.
  useEffect(() => {
    const inv = queryTree.pendingInvalidations;
    if (!inv) return;
    if ((inv.items?.length ?? 0) > 0 || (inv.parents?.length ?? 0) > 0) {
      prefetchedChildrenFileKeysRef.current.clear();
      cachedChildrenFileKeysRef.current.clear();
      prefetchedChildrenFolderLabelsRef.current.clear();
      cachedChildrenFolderLabelsRef.current.clear();
      prefetchedChildrenFolderChildIdsRef.current.clear();
      prefetchedChildrenMaxLevelRef.current.clear();
    }
  }, [queryTree.pendingInvalidations]);

  const logConstraintOnce = (key: string, payload: Record<string, unknown>) => {
    try {
      if (loggedConstraintKeysRef.current.has(key)) return;
      loggedConstraintKeysRef.current.add(key);
      logClientJson('debug', () => payload);
    } catch {}
  };

  const schedulePrefetchDrain = () => {
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
        .then((children) => {
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
  };

  const enqueuePrefetchChildren = (folderId: string, options?: { force?: boolean }) => {
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
  };

  const ensureChildrenUniqCaches = (fid: string, excludeNodeId: string) => {
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
  };

  const getDuplicateFileStatus = (folderId: string, normalizedFileKey: string, excludeNodeId: string): boolean | null => {
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
  };

  const getDuplicateFolderStatus = (folderId: string, normalizedFolderLabel: string, excludeNodeId: string): boolean | null => {
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
  };

  function drainFolderSubtreeExplore(): void {
    const rootId = activeFolderDragIdRef.current;
    if (!rootId) return;

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

  const tree = useTree<TreeNode>({
    rootItemId: rootId,
    indent, // AIDEV-NOTE: The library computes left offset per row from this indent; we keep row styles from item.getProps()
    getItemName: (item) => adapterGetItemName(item as any),
    isItemFolder: (item) => adapterIsItemFolder(item as any),
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature, expandAllFeature],
    dataLoader: {
      getItem: async (nodeId) => {
        // Read from ref instead of closure to get latest data
        const item = queryTreeRef.current?.nodes?.[nodeId as UUIDv7];
        return item as TreeNode;
      },
      getChildrenWithData: async (nodeId) => {
        const currentTree = queryTreeRef.current;
        const childrenNodeIds = currentTree?.childrenByParentId?.[nodeId as UUIDv7];

        // If children are already in the tree, return them
        if (childrenNodeIds !== undefined) {
          const rows = (childrenNodeIds || []).map((cid: string) => ({ id: cid, data: currentTree.nodes[cid] }));
          return rows as { id: string; data: TreeNode }[];
        }

        // AIDEV-NOTE: Children not present — fetch from backend for this node (including root).
        const children = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId })).unwrap();
        return (children || []).map((cid: TreeNode) => ({ id: cid.nodeId, data: cid })) as { id: string; data: TreeNode }[];
      }
    },
    // AIDEV-NOTE: Expanded root so the library constructs items on mount/remount.
    // AIDEV-NOTE: Combined with the hydration reload + invalidate below, this avoids the library sticking to an initial "empty" cache.
    initialState: { expandedItems: [rootId], selectedItems: [rootId], focusedItem: rootId },
    createLoadingItemData: () => adapterCreateLoadingItemData() as unknown as TreeNode,
    // AIDEV-NOTE: DnD configuration per headless-tree docs: https://headless-tree.lukasbach.com/features/dnd/
    // For saved QueryTree we support **file/folder → folder/root** moves. Explicit manual reordering is
    // not persisted (server sorts folders-first A→Z), so we do not model reorder-on-drop.
    canDrag: (items) => {
      if (!Array.isArray(items) || items.length !== 1) return false;
      const it = items[0];
      if (!it) return false;
      const id = it?.getId?.();
      if (!id) return false;
      if (String(id) === String(rootId)) return false;
      const data = it?.getItemData?.() as TreeNode | undefined;
      if (!data) return false;
      return data.kind === 'file' || data.kind === 'folder';
    },
    canDrop: (items, target) => {
      if (!Array.isArray(items) || items.length !== 1) return false;
      const dragged = items[0];
      const targetItem = target.item;
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
        activeDragIdRef.current = String(dragId);
        activeFolderDragIdRef.current = null;
        prefetchedFoldersRef.current.clear();
        prefetchedChildrenFileKeysRef.current.clear();
        cachedChildrenFileKeysRef.current.clear();
        prefetchedChildrenFolderLabelsRef.current.clear();
        cachedChildrenFolderLabelsRef.current.clear();
        prefetchedChildrenFolderChildIdsRef.current.clear();
        prefetchedChildrenMaxLevelRef.current.clear();
        loggedConstraintKeysRef.current.clear();
        prefetchQueueRef.current = [];
        prefetchLastTsRef.current = 0;
        folderSubtreeKnownMaxLevelRef.current = 0;
        folderSubtreeRootLevelRef.current = 0;
        folderSubtreeKnownFoldersRef.current.clear();
        folderSubtreeExploredFoldersRef.current.clear();
        folderSubtreeMissingChildrenRef.current.clear();
        folderSubtreeExploreQueueRef.current = [];
        folderSubtreePrefetchBudgetRef.current = 0;
      }

      const draggedData = dragged.getItemData?.() as TreeNode | undefined;
      const targetData  = targetItem.getItemData?.() as TreeNode | undefined;
      if (!draggedData) return false;

      // AIDEV-NOTE: The section root (`queries`) is a synthetic item that is not stored in Redux
      // `nodes`, so headless-tree may not have itemData for it. Treat it as a folder target so
      // users can drag files back out of folders into the root section.
      const isRootTarget = String(dropTargetId) === String(rootId);
      const effectiveTargetData = isRootTarget ? ({
        nodeId       : String(rootId),
        parentNodeId : null,
        kind         : 'folder',
        label        : String(label ?? 'QUERIES'),
        sortKey      : '',
        mountId      : String(rootId),
        level        : 0
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
            nodeId       : String(rootId),
            parentNodeId : null,
            kind         : 'folder',
            label        : String(label ?? 'QUERIES'),
            sortKey      : '',
            mountId      : String(rootId),
            level        : 0
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
        activeFolderDragIdRef.current = String(dragId);
        const rootLevel = Number((draggedData as any)?.level ?? 0);
        folderSubtreeRootLevelRef.current = Number.isFinite(rootLevel) ? rootLevel : 0;
        folderSubtreeKnownMaxLevelRef.current = folderSubtreeRootLevelRef.current;
        folderSubtreeKnownFoldersRef.current.clear();
        folderSubtreeExploredFoldersRef.current.clear();
        folderSubtreeMissingChildrenRef.current.clear();
        folderSubtreeExploreQueueRef.current = [];
        folderSubtreePrefetchBudgetRef.current = FOLDER_SUBTREE_PREFETCH_MAX;
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
            event         : 'queryTree',
            phase         : 'constraint-violation',
            constraint    : 'move-base',
            code          : base,
            reason        : getMoveViolationLabel(base),
            dragId        : String(dragId),
            dropTargetId  : String(dropTargetId),
            resolvedDropTargetId : String(resolvedDropTargetId),
            isBetweenRows : isBetweenRows
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
                  event         : 'queryTree',
                  phase         : 'constraint-violation',
                  constraint    : 'cycle',
                  dragId        : String(dragId),
                  dropTargetId  : String(dropTargetId),
                  resolvedDropTargetId : String(resolvedDropTargetId)
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
              event         : 'queryTree',
              phase         : 'constraint-violation',
              constraint    : 'max-depth',
              dragId        : String(dragId),
              dropTargetId  : String(dropTargetId),
              resolvedDropTargetId : String(resolvedDropTargetId),
              newLevel      : newLevel,
              maxDepth      : MAX_QUERY_TREE_DEPTH
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
                event         : 'queryTree',
                phase         : 'constraint-violation',
                constraint    : 'max-depth-subtree',
                dragId        : String(dragId),
                dropTargetId  : String(dropTargetId),
                resolvedDropTargetId : String(resolvedDropTargetId),
                newMaxLevel   : newMax,
                maxDepth      : MAX_QUERY_TREE_DEPTH,
                loadedComplete: folderSubtreeMissingChildrenRef.current.size === 0
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
              event         : 'queryTree',
              phase         : 'constraint-violation',
              constraint    : 'duplicate-name',
              dragId        : String(dragId),
              dropTargetId  : String(dropTargetId),
              resolvedDropTargetId : String(resolvedDropTargetId)
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
              event         : 'queryTree',
              phase         : 'constraint-violation',
              constraint    : 'duplicate-folder',
              dragId        : String(dragId),
              dropTargetId  : String(dropTargetId),
              resolvedDropTargetId : String(resolvedDropTargetId)
            }
          );
          return false;
        }
        if (dupe === null) {
          enqueuePrefetchChildren(String(resolvedDropTargetId));
        }
      }

      return true;
    },
    openOnDropDelay: 250,
    onDrop: async (items, target) => {
      if (!Array.isArray(items) || items.length !== 1) return;
      const dragged = items[0];
      const dragId = dragged?.getId?.();
      const targetItem = target.item;
      const dropTargetId = targetItem?.getId?.();
      if (!dragId || !dropTargetId) return;

      const draggedData = dragged.getItemData?.() as TreeNode | undefined;
      if (!draggedData) return;

      const isBetweenRows =
        !!target
        && typeof target === 'object'
        && ('childIndex' in (target as any))
        && typeof (target as any).childIndex === 'number';

      const targetData  = targetItem.getItemData?.() as TreeNode | undefined;
      const resolvedDropTargetId = (() => {
        if (!isBetweenRows) return String(dropTargetId);
        const pid = (targetData as any)?.parentNodeId;
        if (pid == null || pid === '') return String(rootId);
        return String(pid);
      })();

      const draggedParentId = String((draggedData as any).parentNodeId ?? rootId);
      if (draggedParentId && draggedParentId === String(resolvedDropTargetId)) return;

      // AIDEV-NOTE: For saved QueryTree we treat allowed drops as "move into folder/root".
      await actions.handleDropMove(String(dragId), String(resolvedDropTargetId), true);
    }
  });

  const expandedItems = tree.getState().expandedItems;
  const expandedFolderIds = useMemo(() => {
    // AIDEV-NOTE: Preserve order and let the persistence hook normalize/sort. This avoids
    // double-sorting on every expand/collapse interaction.
    return (expandedItems || []).filter((id) => id !== rootId);
  }, [expandedItems, rootId]);

  // AIDEV-NOTE: Restore expanded folders from localStorage after hydration.
  // We set expandedItems directly so deep expansions work with async children.
  useEffect(() => {
    if (persistedExpandedFolders === null) return;
    // Once restored for this scope, do not keep re-applying state on every persisted update.
    if (expansionRestoreCompleteRef.current) return;

    // AIDEV-NOTE: persistedExpandedFolders is already normalized by the hook.
    const targetFolders = persistedExpandedFolders.filter((id) => id !== rootId);
    const targetExpandedItems = [rootId, ...targetFolders];
    const currentExpandedItems = tree.getState().expandedItems || [];

    // AIDEV-NOTE: Compare as sets to avoid unnecessary work due to ordering differences.
    const currentSet  = new Set(currentExpandedItems);
    const targetSet   = new Set(targetExpandedItems);
    if (currentSet.size === targetSet.size) {
      let match = true;
      for (const id of currentSet) {
        if (!targetSet.has(id)) {
          match = false;
          break;
        }
      }
      if (match) return;
    }

    try {
      tree.setConfig((prev) => ({
        ...prev,
        state: {
          ...(prev.state || {}),
          expandedItems: targetExpandedItems
        }
      }));
    } catch {
      // Ignore restore failures; fallback is the in-memory tree state.
    }
  }, [persistedExpandedFolders, rootId, tree]);

  // AIDEV-NOTE: Persist expanded folder state once restoration has completed.
  // This prevents clobbering localStorage with the default (root-only) state on first load.
  useEffect(() => {
    if (persistedExpandedFolders === null) return;

    // AIDEV-NOTE: Compare as sets to avoid extra sorting/normalization on every expand/collapse.
    const currentSet    = new Set(expandedFolderIds);
    const persistedSet  = new Set<string>();
    for (const id of persistedExpandedFolders) {
      if (id === rootId) continue;
      persistedSet.add(id);
    }

    let isEqual = currentSet.size === persistedSet.size;
    if (isEqual) {
      for (const id of currentSet) {
        if (!persistedSet.has(id)) {
          isEqual = false;
          break;
        }
      }
    }

    if (!expansionRestoreCompleteRef.current) {
      if (!isEqual) {
        return;
      }
      expansionRestoreCompleteRef.current = true;
    }

    if (isEqual) return;
    setPersistedExpandedFolders(expandedFolderIds);
  }, [expandedFolderIds, persistedExpandedFolders, rootId, setPersistedExpandedFolders]);

  // AIDEV-NOTE: Draft node insertion/removal does not remount the tree (see resetKey above),
  // so we must refresh the parent's children ids when a draft appears/disappears.
  const lastDraftParentIdRef = useRef<string | null>(null);
  useEffect(() => {
    const draftParentId = draftFolder?.parentId || draftFile?.parentId;
    if (draftParentId) lastDraftParentIdRef.current = draftParentId;
    const parentId = draftParentId ?? lastDraftParentIdRef.current;
    if (!parentId) return;

    try {
      const parentItem = (tree as any).getItemInstance(parentId);
      (parentItem as any)?.invalidateChildrenIds?.();
    } catch {}

    try { (tree as any).loadChildrenIds?.(parentId); } catch {}
  }, [draftFolder?.nodeId, draftFolder?.parentId, draftFile?.nodeId, draftFile?.parentId, tree]);

  // AIDEV-NOTE: Row actions scoped to this section root
  const actions = useItemActions(tree as any, rootId, {
    onCreateFolderDraft: async () => {
      // AIDEV-NOTE: Only one draft row can exist at a time. If the user clicks “New Folder”
      // while an empty draft exists, cancel it and proceed. If it has text or is submitting,
      // keep it and focus it instead to avoid data loss.
      if (draftFolder) {
        if (draftFolder.isSubmitting) return;
        const trimmed = (draftFolder.name ?? '').trim();
        if (!trimmed) {
          dispatch(removeNode({ parentId: draftFolder.parentId, nodeId: draftFolder.nodeId }));
          setDraftFolder(null);
        } else {
          selectTreeItem(draftFolder.nodeId);
          return;
        }
      }
      if (draftFile) {
        if (draftFile.isSubmitting) return;
        const trimmed = (draftFile.name ?? '').trim();
        if (!trimmed) {
          dispatch(removeNode({ parentId: draftFile.parentId, nodeId: draftFile.nodeId }));
          setDraftFile(null);
        } else {
          selectTreeItem(draftFile.nodeId);
          return;
        }
      }

      const placement = getCreatePlacement('folder');
      const parentId  = placement.parentNodeId;
      let fetchedChildren: TreeNode[] | null = null;

      // AIDEV-NOTE: If creating inside a folder, ensure it is expanded and its children
      // are present in Redux so we don't replace previously loaded children.
      if (parentId && parentId !== rootId) {
        try {
          const known = queryTreeRef.current?.childrenByParentId?.[parentId as any];
          if (known === undefined) {
            fetchedChildren = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId: parentId })).unwrap();
          } else {
            // AIDEV-NOTE: Children already in Redux; use them as fetchedChildren baseline.
            fetchedChildren = (known || []).map((id: string) => queryTreeRef.current?.nodes?.[id]).filter(Boolean) as TreeNode[];
          }
        } catch {}

        // AIDEV-NOTE: Prime HT's childrenIds cache BEFORE expanding so HT doesn't schedule a
        // background load via setTimeout. The background load races with our draft insertion
        // and can overwrite our cache update, causing the draft row to disappear.
        primeChildrenIdsCache(tree as any, String(parentId), fetchedChildren);

        // AIDEV-NOTE: Expand after children are known so headless-tree can render the draft reliably.
        await ensureFolderExpanded(parentId);
      }

      const nodeId    = generateUUIDv7() as unknown as string;
      const folderId  = generateUUIDv7() as unknown as string;

      const parentLevel = (() => {
        if (parentId === rootId) return 0;
        const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
        const lvl = Number(p?.level ?? 0);
        return Number.isFinite(lvl) ? lvl : 0;
      })();

      const draftNode: TreeNode = {
        nodeId       : nodeId as UUIDv7,
        parentNodeId : parentId,
        kind         : 'folder',
        label        : '',
        sortKey      : '',
        // AIDEV-NOTE: mountId is the canonical folder id (queryTreeFolderId), distinct from nodeId.
        mountId      : folderId as UUIDv7,
        level        : parentLevel + 1
      };

      // AIDEV-NOTE: Draft insertion is synchronous; prefer direct actions over a thunk
      // to avoid extra pending/fulfilled actions and reduce render churn.
      dispatch(upsertNode(draftNode));
      const insertIndex = (() => {
        if (placement.placement === 'top') return 0;
        if (fetchedChildren) {
          // AIDEV-NOTE: If we just loaded children for a previously-unknown folder, compute the
          // folder/file boundary deterministically from the fetched list.
          let idx = 0;
          for (; idx < fetchedChildren.length; idx++) {
            const k = (fetchedChildren[idx] as any)?.kind;
            if (k !== 'folder') break;
          }
          return idx;
        }
        return getInsertIndexForPlacement(parentId, 'after-last-folder');
      })();
      dispatch(insertChildAtIndex({
        parentId,
        node: draftNode,
        index: insertIndex
      }));
      // AIDEV-NOTE: Headless-tree async loader caches childrenIds per parent. When a folder was
      // expanded while empty, HT may cache `[]` and won't see Redux insertions automatically.
      // Update the cache directly so the draft row renders immediately (no refetch needed).
      try {
        const baseIds = (() => {
          if (fetchedChildren) return fetchedChildren.map((c) => String((c as any)?.nodeId ?? '')).filter(Boolean);
          const ids = queryTreeRef.current?.childrenByParentId?.[String(parentId) as any] || [];
          return Array.isArray(ids) ? ids.map((x) => String(x)).filter(Boolean) : [];
        })();
        const nextIds = computeChildrenIdsAfterInsert(baseIds, String(nodeId), insertIndex);
        updateChildrenIdsCache(tree as any, String(parentId), nextIds);
      } catch {}
      // AIDEV-NOTE: For empty folders, some headless-tree configs won't “open” a folder until
      // it has a child. Re-attempt expansion after insertion so the draft is visible.
      if (parentId && parentId !== rootId) {
        try {
          requestAnimationFrame(() => {
            void ensureFolderExpanded(parentId);
            selectTreeItem(nodeId);
            scrollSelectedRowIntoView();
            debugLog('draftCreated', { kind: 'folder', parentId, nodeId });
          });
        } catch {
          selectTreeItem(nodeId);
          scrollSelectedRowIntoView();
          debugLog('draftCreated', { kind: 'folder', parentId, nodeId });
        }
      } else {
        selectTreeItem(nodeId);
        scrollSelectedRowIntoView();
        debugLog('draftCreated', { kind: 'folder', parentId, nodeId });
      }

      // AIDEV-NOTE: Persist draft editing state across the keyed remount by storing
      // it in the outer wrapper.
      setDraftFolder({
        nodeId,
        parentId,
        name: '',
        isSubmitting: false
      });
    },
    onCreateFileDraft: async () => {
      // AIDEV-NOTE: Only one draft row can exist at a time. If the user clicks “New File”
      // while an empty draft exists, cancel it and proceed. If it has text or is submitting,
      // keep it and focus it instead to avoid data loss.
      if (draftFolder) {
        if (draftFolder.isSubmitting) return;
        const trimmed = (draftFolder.name ?? '').trim();
        if (!trimmed) {
          dispatch(removeNode({ parentId: draftFolder.parentId, nodeId: draftFolder.nodeId }));
          setDraftFolder(null);
        } else {
          selectTreeItem(draftFolder.nodeId);
          return;
        }
      }
      if (draftFile) {
        if (draftFile.isSubmitting) return;
        const trimmed = (draftFile.name ?? '').trim();
        if (!trimmed) {
          dispatch(removeNode({ parentId: draftFile.parentId, nodeId: draftFile.nodeId }));
          setDraftFile(null);
        } else {
          selectTreeItem(draftFile.nodeId);
          return;
        }
      }

      const placement   = getCreatePlacement('file');
      const parentId    = placement.parentNodeId;
      let fetchedChildren: TreeNode[] | null = null;

      // AIDEV-NOTE: If creating inside a folder, ensure it is expanded and its children
      // are present in Redux so we don't replace previously loaded children.
      if (parentId && parentId !== rootId) {
        try {
          const known = queryTreeRef.current?.childrenByParentId?.[parentId as any];
          if (known === undefined) {
            fetchedChildren = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId: parentId })).unwrap();
          } else {
            // AIDEV-NOTE: Children already in Redux; use them as fetchedChildren baseline.
            fetchedChildren = (known || []).map((id: string) => queryTreeRef.current?.nodes?.[id]).filter(Boolean) as TreeNode[];
          }
        } catch {}

        // AIDEV-NOTE: Prime HT's childrenIds cache BEFORE expanding so HT doesn't schedule a
        // background load via setTimeout. The background load races with our draft insertion
        // and can overwrite our cache update, causing the draft row to disappear.
        primeChildrenIdsCache(tree as any, String(parentId), fetchedChildren);

        // AIDEV-NOTE: Expand after children are known so headless-tree can render the draft reliably.
        await ensureFolderExpanded(parentId);
      }

      const nodeId      = generateUUIDv7() as unknown as string;
      const dataQueryId = generateUUIDv7() as unknown as UUIDv7;

      const parentLevel = (() => {
        if (parentId === rootId) return 0;
        const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
        const lvl = Number(p?.level ?? 0);
        return Number.isFinite(lvl) ? lvl : 0;
      })();

      const draftNode: TreeNode = {
        nodeId       : nodeId as unknown as UUIDv7,
        parentNodeId : parentId,
        kind         : 'file',
        label        : '',
        ext          : DEFAULT_QUERY_FILE_EXT,
        sortKey      : '',
        mountId      : dataQueryId,
        level        : parentLevel + 1
      };

      dispatch(upsertNode(draftNode));
      const insertIndex = (() => {
        if (placement.placement === 'after-selected' && placement.afterNodeId) {
          const ids = queryTreeRef.current?.childrenByParentId?.[String(parentId) as any] || [];
          if (Array.isArray(ids)) {
            const i = ids.indexOf(String(placement.afterNodeId));
            if (i >= 0) return i + 1;
          }
        }
        if (fetchedChildren && placement.placement !== 'after-selected') {
          // AIDEV-NOTE: If we just loaded children for a previously-collapsed folder, use the
          // fetched list (not queryTreeRef) to compute the folder/file boundary deterministically.
          let idx = 0;
          for (; idx < fetchedChildren.length; idx++) {
            const k = (fetchedChildren[idx] as any)?.kind;
            if (k !== 'folder') break;
          }
          return idx;
        }
        return getInsertIndexForPlacement(
          parentId,
          placement.placement === 'top' ? 'top' : 'after-last-folder'
        );
      })();
      dispatch(insertChildAtIndex({
        parentId,
        node: draftNode,
        index: insertIndex
      }));
      // AIDEV-NOTE: Keep headless-tree childrenIds cache in sync so drafts render immediately.
      try {
        const baseIds = (() => {
          if (fetchedChildren) return fetchedChildren.map((c) => String((c as any)?.nodeId ?? '')).filter(Boolean);
          const ids = queryTreeRef.current?.childrenByParentId?.[String(parentId) as any] || [];
          return Array.isArray(ids) ? ids.map((x) => String(x)).filter(Boolean) : [];
        })();
        const nextIds = computeChildrenIdsAfterInsert(baseIds, String(nodeId), insertIndex);
        updateChildrenIdsCache(tree as any, String(parentId), nextIds);
      } catch {}
      // AIDEV-NOTE: For empty folders, some headless-tree configs won't “open” a folder until
      // it has a child. Re-attempt expansion after insertion so the draft is visible.
      if (parentId && parentId !== rootId) {
        try {
          requestAnimationFrame(() => {
            void ensureFolderExpanded(parentId);
            selectTreeItem(nodeId);
            scrollSelectedRowIntoView();
            debugLog('draftCreated', {
              kind: 'file',
              parentId,
              nodeId,
              insertIndex,
              placement: (placement as any)?.placement,
              afterNodeId: (placement as any)?.afterNodeId
            });
          });
        } catch {
          selectTreeItem(nodeId);
          scrollSelectedRowIntoView();
          debugLog('draftCreated', {
            kind: 'file',
            parentId,
            nodeId,
            insertIndex,
            placement: (placement as any)?.placement,
            afterNodeId: (placement as any)?.afterNodeId
          });
        }
      } else {
        selectTreeItem(nodeId);
        scrollSelectedRowIntoView();
        debugLog('draftCreated', {
          kind: 'file',
          parentId,
          nodeId,
          insertIndex,
          placement: (placement as any)?.placement,
          afterNodeId: (placement as any)?.afterNodeId
        });
      }

      setDraftFile({
        nodeId,
        parentId,
        dataQueryId,
        name: '',
        isSubmitting: false
      });
    }
  });

  // AIDEV-NOTE: Process pending invalidations from Redux - O(k) where k = invalidations.
  // This tells headless-tree to refresh its internal cache for affected items.
  useEffect(() => {
    const inv = queryTree.pendingInvalidations;
    if (!inv) return;

    const hasItems = inv.items?.length > 0;
    const hasParents = inv.parents?.length > 0;

    if (!hasItems && !hasParents) return;

    // Capture what we're processing (for race-safe clear)
    const itemsToProcess = [...(inv.items || [])];
    const parentsToProcess = [...(inv.parents || [])];

    // Process item invalidations (label changes)
    for (const nodeId of itemsToProcess) {
      try {
        const item = tree.getItemInstance(nodeId);
        (item as any)?.invalidateItemData?.();
      } catch {}
    }

    // Process parent invalidations (sort order changes)
    for (const parentId of parentsToProcess) {
      try {
        const item = tree.getItemInstance(parentId);
        (item as any)?.invalidateChildrenIds?.();
      } catch {}
    }

    // Clear only what we processed (race-safe)
    dispatch(clearInvalidations({ items: itemsToProcess, parents: parentsToProcess }));
  }, [queryTree.pendingInvalidations, tree, dispatch]);

  // AIDEV-NOTE: Ref for scroll host (used for scrollbar gutter detection).
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // AIDEV-NOTE: Ref for the section element, used to detect clicks outside the tree.
  const sectionRef = useRef<HTMLElement | null>(null);

  // AIDEV-NOTE: Track whether the user has selected a row in this tree section.
  // This state drives toolbar visibility when the mouse leaves but the user hasn't
  // clicked outside the tree section yet.
  const [isTreeFocused, setIsTreeFocused] = useState<boolean>(false);

  // AIDEV-NOTE: Keep the latest draft refs for global event handlers so we don't rely on
  // React state timing (e.g., dblclick can fire before blur-driven draft cancel commits).
  const draftFolderRef = useRef<DraftFolderState | null>(null);
  const draftFileRef   = useRef<DraftFileState | null>(null);
  draftFolderRef.current = draftFolder;
  draftFileRef.current   = draftFile;

  const selectTreeItem = useCallback((nodeId: string) => {
    const id = String(nodeId || '');
    if (!id) return;
    try {
      if (typeof (tree as any).setSelectedItems === 'function') {
        (tree as any).setSelectedItems([id]);
      }
    } catch {}

    try {
      tree.setConfig((prev) => ({
        ...prev,
        state: {
          ...(prev.state || {}),
          focusedItem: id
        }
      }));
    } catch {}

    // AIDEV-NOTE: Treat toolbar-driven create as an explicit tree interaction.
    setIsTreeFocused(true);
  }, [tree]);

  const debugLog = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'production') return;
    // eslint-disable-next-line no-console
    console.log('[QueryTree]', event, payload || {});
  }, []);

  const scrollSelectedRowIntoView = useCallback(() => {
    try {
      requestAnimationFrame(() => {
        try {
          const el = document.querySelector('[data-row="true"][aria-selected="true"]') as HTMLElement | null;
          el?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        } catch {}
      });
    } catch {}
  }, []);

  const getCreatePlacement = useCallback((createKind: 'folder' | 'file') => {
    // AIDEV-NOTE: Derive draft placement from headless-tree selection/focus state.
    // Prefer selectedItems (matches visible highlight).
    // AIDEV-NOTE: UX rule — if this tree section is not focused (no active highlight),
    // treat toolbar create as "create at root" even if headless-tree still holds an old selection.
    // This avoids surprising inserts into a previously-selected folder after the user clicks away.
    if (!isTreeFocused) {
      return { parentNodeId: String(rootId), placement: 'after-last-folder' as const };
    }
    // AIDEV-NOTE: In this headless-tree version, `focusedItem` can lag behind selection and
    // is not reliably settable via config updates, so we intentionally do NOT use it for placement.
    const state = tree.getState?.() as any;
    const selectedItems = (state?.selectedItems || []) as string[];

    const pickSelectedId = () => {
      // Prefer the most recent non-root selection if multiple exist.
      for (let i = selectedItems.length - 1; i >= 0; i--) {
        const id = String(selectedItems[i]);
        if (id && id !== String(rootId)) return id;
      }
      return '';
    };

    const selectedId = pickSelectedId();
    const selectedNode = selectedId ? (queryTreeRef.current?.nodes?.[selectedId] as any) : null;

    // No selection => root, after last folder boundary.
    if (!selectedId || !selectedNode) {
      return { parentNodeId: String(rootId), placement: 'after-last-folder' as const };
    }

    if (selectedNode.kind === 'folder') {
      if (createKind === 'file') {
        // Folder selected + new file => within folder, after last folder boundary.
        return { parentNodeId: String(selectedId), placement: 'after-last-folder' as const };
      }
      // Folder selected + new folder => within folder, first child (visually right below folder row).
      return { parentNodeId: String(selectedId), placement: 'top' as const };
    }

    // File selected => create in its parent.
    const parentNodeId = String(selectedNode.parentNodeId ?? rootId);
    if (!parentNodeId || parentNodeId === String(rootId)) {
      if (createKind === 'file') {
        // File under root + new file => insert directly below selected file.
        return { parentNodeId: String(rootId), placement: 'after-selected' as const, afterNodeId: String(selectedId) };
      }
      // File under root + new folder => root, after last folder boundary.
      return { parentNodeId: String(rootId), placement: 'after-last-folder' as const };
    }
    if (createKind === 'file') {
      // File inside folder + new file => insert directly below selected file.
      return { parentNodeId, placement: 'after-selected' as const, afterNodeId: String(selectedId) };
    }
    // File inside folder + new folder => parent folder, first child (visually right below folder row).
    return { parentNodeId, placement: 'top' as const };
  }, [tree, rootId, isTreeFocused]);

  const getInsertIndexForPlacement = useCallback((parentNodeId: string, placement: 'top' | 'after-last-folder') => {
    if (placement === 'top') return 0;
    // AIDEV-NOTE: Root children are folder-first, so the first non-folder index is “after last folder”.
    const ids = queryTreeRef.current?.childrenByParentId?.[String(parentNodeId) as any] || [];
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let idx = 0;
    for (; idx < ids.length; idx++) {
      const n = queryTreeRef.current?.nodes?.[String(ids[idx]) as any] as any;
      if (!n || n.kind !== 'folder') break;
    }
    return idx;
  }, []);

  const ensureFolderExpanded = useCallback((folderNodeId: string): Promise<void> => {
    return new Promise((resolve) => {
      const id = String(folderNodeId || '');
      if (!id) {
        resolve();
        return;
      }
      if (id === String(rootId)) {
        resolve();
        return;
      }

      const debug = (...args: any[]) => {
        if (process.env.NODE_ENV === 'production') return;
        // eslint-disable-next-line no-console
        console.log('[QueryTree]', ...args);
      };

      const readExpandedIds = () => {
        try {
          const cur = (tree.getState?.()?.expandedItems || []) as any;
          return Array.isArray(cur) ? cur.map((x) => String(x)) : [];
        } catch {
          return [];
        }
      };

      const expandedStateBefore = (() => {
        try {
          const curArr = readExpandedIds();
          return curArr.includes(id);
        } catch {
          return null;
        }
      })();

      debug('ensureFolderExpanded:start', { folderNodeId: id, expandedStateBefore });

      // AIDEV-NOTE: If already expanded, resolve immediately (avoids unnecessary RAF delays).
      if (expandedStateBefore === true) {
        debug('ensureFolderExpanded:already-expanded', { folderNodeId: id });
        resolve();
        return;
      }

      // AIDEV-NOTE: Use getItemInstance for reliable item lookup by ID (doesn't depend on rendered items).
      let didExpandByItem = false;
      try {
        const it = (tree as any).getItemInstance?.(id);
        if (it) {
          const isFolder = !!it?.isFolder?.();
          const isExpanded = it?.isExpanded?.();
          debug('ensureFolderExpanded:item-check', { folderNodeId: id, hasItem: true, isFolder, isExpanded });
          if (isFolder && isExpanded === false) {
            it.expand?.();
            didExpandByItem = true;
          }
        } else {
          debug('ensureFolderExpanded:item-not-found-via-instance', { folderNodeId: id });
        }
      } catch (err) {
        debug('ensureFolderExpanded:getItemInstance-error', { folderNodeId: id, error: err });
      }

      // Fallback: set expandedItems via tree API / config (works even if item API isn't available).
      if (!didExpandByItem) {
        try {
          const curArr = readExpandedIds();
          const next = Array.from(new Set([...curArr, String(rootId), id]));

          // AIDEV-NOTE: Prefer the library's state setter if present (mirrors setSelectedItems behavior).
          if (typeof (tree as any).setExpandedItems === 'function') {
            debug('ensureFolderExpanded:setExpandedItems', { folderNodeId: id, nextCount: next.length });
            (tree as any).setExpandedItems(next);
          } else if (!curArr.includes(id)) {
            debug('ensureFolderExpanded:setConfig-expandedItems', { folderNodeId: id, nextCount: next.length });
            tree.setConfig((prev) => {
              const prevState = (prev as any).state || {};
              return {
                ...(prev as any),
                state: {
                  ...prevState,
                  expandedItems: next
                }
              };
            });
          }
        } catch {}
      }

      // AIDEV-NOTE: Some headless-tree paths only load children when expand() is called.
      // Ensure children load when we toggle expandedItems via config.
      try { (tree as any).loadChildrenIds?.(id); } catch {}

      const finish = () => {
        try {
          const curArr = readExpandedIds();
          let itemExpanded: boolean | null = null;
          try {
            const it = (tree as any).getItemInstance?.(id);
            itemExpanded = it?.isExpanded?.() ?? null;
          } catch {}
          debug('ensureFolderExpanded:done', { folderNodeId: id, didExpandByItem, expandedStateAfter: curArr.includes(id), itemExpanded, expandedItems: curArr });
        } catch {}
        resolve();
      };

      // AIDEV-NOTE: Wait for the next animation frame(s) so expansion state is reflected in the UI
      // before callers insert/select draft nodes.
      try {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            finish();
          });
        });
      } catch {
        try {
          window.setTimeout(() => finish(), 0);
        } catch {
          finish();
        }
      }
    });
  }, [tree, rootId]);

  const createRootFileDraft = useCallback(() => {
    const parentId = rootId;
    const nodeId = generateUUIDv7() as unknown as string;
    const dataQueryId = generateUUIDv7() as unknown as UUIDv7;

    const draftNode: TreeNode = {
      nodeId       : nodeId as unknown as UUIDv7,
      parentNodeId : parentId,
      kind         : 'file',
      label        : '',
      ext          : DEFAULT_QUERY_FILE_EXT,
      sortKey      : '',
      mountId      : dataQueryId,
      level        : 1
    };

    dispatch(upsertNode(draftNode));
    dispatch(insertChildAtIndex({
      parentId,
      node: draftNode,
      index: getInsertIndexForPlacement(parentId, 'after-last-folder')
    }));

    setDraftFile({
      nodeId,
      parentId,
      dataQueryId,
      name: '',
      isSubmitting: false
    });

    selectTreeItem(nodeId);

    // AIDEV-NOTE: Best-effort scroll into view so the user always sees the draft row.
    try {
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-row="true"][aria-selected="true"]') as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
      });
    } catch {}
  }, [dispatch, getInsertIndexForPlacement, rootId, selectTreeItem, setDraftFile]);

  const pendingClearSelectionRafRef = useRef<number | null>(null);

  const clearTreeSelectionToRoot = useCallback(() => {
    // AIDEV-NOTE: Clear selection to a "no visible selection" sentinel (root is not rendered as a row).
    // Schedule after event processing so headless-tree doesn't overwrite during the same click.
    try {
      if (pendingClearSelectionRafRef.current != null) {
        cancelAnimationFrame(pendingClearSelectionRafRef.current);
      }
    } catch {}

    try {
      pendingClearSelectionRafRef.current = requestAnimationFrame(() => {
        pendingClearSelectionRafRef.current = null;

        try {
          setIsTreeFocused(false);
        } catch {}

        try {
          if (typeof (tree as any).setSelectedItems === 'function') {
            (tree as any).setSelectedItems([rootId]);
            // Best-effort: also reset focusedItem. Some headless-tree versions don't reliably accept focusedItem updates.
            try {
              tree.setConfig((prev) => {
                const prevState = prev.state || {};
                return {
                  ...prev,
                  state: {
                    ...prevState,
                    focusedItem: rootId
                  }
                };
              });
            } catch {}
          } else {
            tree.setConfig((prev) => {
              const prevState = prev.state || {};
              return {
                ...prev,
                state: {
                  ...prevState,
                  selectedItems: [rootId],
                  focusedItem: rootId
                }
              };
            });
          }
        } catch {}
      });
    } catch {
      // If RAF isn't available for some reason, do best-effort sync.
      try {
        setIsTreeFocused(false);
      } catch {}
      try {
        if (typeof (tree as any).setSelectedItems === 'function') {
          (tree as any).setSelectedItems([rootId]);
        }
      } catch {}
    }
  }, [tree, rootId]);

  const handleTreeSectionClickCapture = useCallback((e: React.MouseEvent<HTMLElement>) => {
    // AIDEV-NOTE: Background click within the section clears selection.
    // Ignore row clicks and toolbar clicks.
    const section = sectionRef.current;
    if (!section) return;

    const target = e.target as Element | null;
    if (!target || section !== target) return;

    // Clear any pending click
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    // Delay the click action
    clickTimeoutRef.current = window.setTimeout(() => {
      clearTreeSelectionToRoot();
      clickTimeoutRef.current = null;
    }, 150);
  }, [clearTreeSelectionToRoot]);

  const handleTreeSectionDoubleClickCapture = useCallback((e: React.MouseEvent<HTMLElement>) => {
    // AIDEV-NOTE: Background dblclick within the section creates a new *file* draft at the root
    // after the last folder boundary (folder-first sort).
    // Ignore row dblclicks and toolbar dblclicks.

    // Cancel pending single-click
    if (clickTimeoutRef.current !== null) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    const section = sectionRef.current;
    if (!section) return;

    const target = e.target as Element | null;
    if (!target || section !== target ) return;

    try {
      e.preventDefault();
      e.stopPropagation();
    } catch {}

    // If the dblclick's first click causes a blur that cancels a draft, defer creation
    // to the next tick so we see the updated draft refs.
    window.setTimeout(() => {
      const existingFolderDraft = draftFolderRef.current;
      const existingFileDraft   = draftFileRef.current;

      if (existingFolderDraft?.nodeId) {
        selectTreeItem(existingFolderDraft.nodeId);
        return;
      }
      if (existingFileDraft?.nodeId) {
        selectTreeItem(existingFileDraft.nodeId);
        try {
          requestAnimationFrame(() => {
            const el = document.querySelector('[data-row="true"][aria-selected="true"]') as HTMLElement | null;
            el?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
          });
        } catch {}
        return;
      }

      createRootFileDraft();
    }, 0);
  }, [createRootFileDraft, selectTreeItem]);

  // AIDEV-NOTE: Stable callback to avoid breaking Row memo
  const handleTreeFocusFromRow = useCallback(() => setIsTreeFocused(true), []);

  // AIDEV-NOTE: Listen for mousedown outside the tree section to clear the focused state
  // and selection. This is more robust than blur events which can fire unexpectedly during navigation.
  // When clicking within DirectoryPanel but outside this tree section, clear both focus and selection.
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const section = sectionRef.current;
      if (!section) return;

      const target = e.target as Node | null;
      if (!target) return;

      // Check if click is outside the tree section
      if (!section.contains(target)) {
        setIsTreeFocused(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [setIsTreeFocused]);

  // Compute rendering ranges and items outside JSX
  const allItems = (tree as any).getItems?.() ?? [];
  // AIDEV-NOTE: Detect whether any folder (excluding the synthetic section root) is expanded.
  const hasExpandedFolder = allItems.some((it: any) => {
    try {
      if (!it?.isFolder?.()) return false;
      if (it?.getId?.() === rootId) return false;
      return it?.isExpanded?.() === true;
    } catch {
      return false;
    }
  });
  // AIDEV-NOTE: Baseline diagnostic — disable custom virtualization, render all items
  const renderItems = allItems.filter((it: any) => it?.getId?.() !== rootId);

  // AIDEV-NOTE: Toggle scrollbar gutter only when vertical scrollbar is present.
  // This ensures `scrollbar-gutter` is unset when no scrollbar is visible.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let raf = 0;
    const check = () => {
      try {
        const hasY = el.scrollHeight > (el.clientHeight + 1);
        if (hasY) el.setAttribute('data-has-scrollbar', 'true');
        else el.removeAttribute('data-has-scrollbar');
      } catch {}
    };

    check();

    const onResizeFrame = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(onResizeFrame);
      ro.observe(el);
    } catch {}

    window.addEventListener('resize', onResizeFrame);

    return () => {
      try { ro?.disconnect(); } catch {}
      window.removeEventListener('resize', onResizeFrame);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, allItems.length]);

  return (
    <section
      ref={sectionRef}
      className={styles['tree']}
      aria-label={label}
      data-open={isOpen ? 'true' : 'false'}
      data-row-focused={isTreeFocused ? 'true' : 'false'}
      onDoubleClickCapture={handleTreeSectionDoubleClickCapture}
      onClickCapture={handleTreeSectionClickCapture}
    >
      {/* Header with toggle and per-section tools */}
      <div
        className={styles['header']}
        role="heading"
        aria-level={2}
        tabIndex={0}
        aria-expanded={isOpen ? 'true' : 'false'}
        onClick={() => setIsOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((v) => !v);
          }
        }}
      >
        <div className={styles['header-left']}>
          <button
            type="button"
            className={styles['header-toggle']}
            aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
            onClick={(e) => { e.stopPropagation(); setIsOpen((v) => !v); }}
          >
            {isOpen ? (<Icon name="chevron-down" aria-hidden="true" />) : (<Icon name="chevron-right" aria-hidden="true" />)}
          </button>
          <span className={styles['header-label']}>{label.toUpperCase()}</span>
        </div>
        {/* AIDEV-NOTE: Always render toolbar; reveal via CSS only when expanded + hovered */}
        <div
          className={styles['header-tools']}
          onClick={(e) => { e.stopPropagation(); }}
          onKeyDown={(e) => { e.stopPropagation(); }}
        >
          <Toolbar
            onCreateFolder={actions.handleCreateFolder}
            onCreateFile={actions.handleCreateFile}
            onCollapseAll={actions.handleCollapseAll}
            disableCollapseAll={!hasExpandedFolder}
          />
        </div>
      </div>
      {(() => {
        // AIDEV-NOTE: Apply getContainerProps to the scroll host so the library observes scroll/size and binds roles/handlers.
        const rawContainerProps = (tree as any).getContainerProps?.(`${label} Tree`) ?? {};
        const {
          style: containerStyle,
          className: containerClassName,
          onFocus: containerOnFocus,
          onBlur: containerOnBlur,
          ref: containerRef,
          ...containerAriaAndHandlers
        } = (rawContainerProps as any);
        const scrollerBridgeRef = (el: HTMLDivElement | null) => {
          scrollerRef.current = el;
          try {
            const r = containerRef;
            if (typeof r === 'function') r(el);
            else if (r && 'current' in r) (r as any).current = el;
          } catch {}
        };
        const mergedScrollerClass = `${(containerClassName ?? '')} ${styles['scroller']} ${styles['list']}`.trim();

        const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
          try { containerOnFocus?.(e as any); } catch {}
          try { if ((e.currentTarget as HTMLElement).matches('[data-scrollable]')) setIsTreeFocused(true); } catch {}
        };
        // AIDEV-NOTE: We no longer reset isTreeFocused on blur; instead we use a document
        // mousedown listener to detect clicks outside the section. This is more robust
        // because blur events can fire unexpectedly during navigation or async actions.
        const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
          try { containerOnBlur?.(e as any); } catch {}
        };

        return (
          <div className={styles['content']}>
            <div
              {...containerAriaAndHandlers}
              ref={scrollerBridgeRef}
              className={mergedScrollerClass}
              style={containerStyle}
              data-scrollable
              data-focused={isTreeFocused ? 'true' : 'false'}
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              {renderItems.map((it: any) => {
                const itemData = it.getItemData?.() as TreeNode | undefined;
                const mountId  = itemData?.mountId as UUIDv7 | undefined;
                const tabId    = mountId ? mountIdToTabIdMap.get(mountId) : undefined;
                const isActiveFromTab = isOnQueriesRoute && !!tabId && tabId === activeTabId;

                // AIDEV-NOTE: Extract selection state as primitive for memo comparison
                const itemProps = it.getProps?.();
                const ariaSelected = itemProps?.['aria-selected'];
                const isSelectedByTree = ariaSelected === true || ariaSelected === 'true';

                const draftFolderNodeId = draftFolder?.nodeId || null;
                const draftFileNodeId   = draftFile?.nodeId || null;
                const isDraftFolder     = draftFolderNodeId != null && it.getId?.() === draftFolderNodeId;
                const isDraftFile       = draftFileNodeId != null && it.getId?.() === draftFileNodeId;
                const isDraft           = isDraftFolder || isDraftFile;

                return (
                  <Row
                    key={it.getId()}
                    item={it}
                    indent={indent}
                    onRename={actions.handleRename}
                    isTopLevel={false}
                    isTreeFocused={isTreeFocused}
                    onTreeFocusFromRow={handleTreeFocusFromRow}
                    isActiveFromTab={isActiveFromTab}
                    tabId={tabId}
                    isSelectedByTree={isSelectedByTree}
                    isEditing={isDraft}
                    editingName={isDraftFolder ? (draftFolder?.name ?? '') : isDraftFile ? (draftFile?.name ?? '') : undefined}
                    isEditingSubmitting={isDraftFolder ? !!draftFolder?.isSubmitting : isDraftFile ? !!draftFile?.isSubmitting : undefined}
                    onEditingNameChange={(next) => {
                      if (!isDraft) return;
                      if (isDraftFolder) {
                        setDraftFolder((prev) => {
                          if (!prev) return prev;
                          return { ...prev, name: next };
                        });
                      } else if (isDraftFile) {
                        setDraftFile((prev) => {
                          if (!prev) return prev;
                          return { ...prev, name: next };
                        });
                      }
                    }}
                    onEditingCommit={async (finalName) => {
                      if (!isDraft) return;

                      const trimmed = finalName.trim();
                      if (!trimmed) return;

                      if (isDraftFolder) {
                        const parentId = draftFolder?.parentId;
                        const nodeId = draftFolder?.nodeId;
                        if (!parentId || !nodeId) return;
                        if (draftFolder?.isSubmitting) return;

                        setDraftFolder((prev) => {
                          if (!prev) return prev;
                          return { ...prev, isSubmitting: true };
                        });

                        let created: TreeNode | null = null;
                        try {
                          const parentFolderId = (() => {
                            if (String(parentId) === String(rootId)) return undefined;
                            const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
                            if (!p || p.kind !== 'folder') return undefined;
                            const fid = p.mountId;
                            return fid ? String(fid) : undefined;
                          })();

                          created = await dispatch(
                            createQueryFolderThunk({
                              parentFolderId,
                              name: trimmed
                            })
                          ).unwrap();
                        } catch {
                          created = null;
                        }

                        if (created) {
                          dispatch(removeNode({ parentId, nodeId }));
                          setDraftFolder(null);
                          try { selectTreeItem(String((created as any).nodeId ?? '')); } catch {}
                        } else {
                          // AIDEV-NOTE: Backend create failed; keep the draft row so the user
                          // can retry or cancel, and re-enable the input.
                          setDraftFolder((prev) => {
                            if (!prev) return prev;
                            return { ...prev, isSubmitting: false };
                          });
                        }
                      } else if (isDraftFile) {
                        const parentId = draftFile?.parentId;
                        const nodeId = draftFile?.nodeId;
                        const dataQueryId = draftFile?.dataQueryId;
                        if (!parentId || !nodeId || !dataQueryId) return;
                        if (draftFile?.isSubmitting) return;

                        setDraftFile((prev) => {
                          if (!prev) return prev;
                          return { ...prev, isSubmitting: true };
                        });

                        let created: TreeNode | null = null;
                        try {
                          const parentFolderId = (() => {
                            if (String(parentId) === String(rootId)) return undefined;
                            const p = queryTreeRef.current?.nodes?.[String(parentId) as any] as any;
                            if (!p || p.kind !== 'folder') return undefined;
                            const fid = p.mountId;
                            return fid ? String(fid) : undefined;
                          })();

                          created = await dispatch(
                            createSavedQueryFileThunk({
                              dataQueryId,
                              name: trimmed,
                              parentFolderId
                            })
                          ).unwrap();
                        } catch {
                          created = null;
                        }

                        if (created) {
                          dispatch(removeNode({ parentId, nodeId }));
                          setDraftFile(null);
                          try { selectTreeItem(String((created as any).nodeId ?? '')); } catch {}
                          // AIDEV-NOTE: Navigate to the newly created saved query URL.
                          navigateToSaved(created.mountId as UUIDv7);
                        } else {
                          setDraftFile((prev) => {
                            if (!prev) return prev;
                            return { ...prev, isSubmitting: false };
                          });
                        }
                      }
                    }}
                    onEditingCancel={async () => {
                      if (!isDraft) return;

                      if (isDraftFolder) {
                        const parentId = draftFolder?.parentId;
                        const nodeId = draftFolder?.nodeId;
                        if (!parentId || !nodeId) return;
                        if (draftFolder?.isSubmitting) return;
                        dispatch(removeNode({ parentId, nodeId }));
                        setDraftFolder(null);
                      } else if (isDraftFile) {
                        const parentId = draftFile?.parentId;
                        const nodeId = draftFile?.nodeId;
                        if (!parentId || !nodeId) return;
                        if (draftFile?.isSubmitting) return;
                        dispatch(removeNode({ parentId, nodeId }));
                        setDraftFile(null);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}
    </section>
  );
}


export default QueriesTree;
