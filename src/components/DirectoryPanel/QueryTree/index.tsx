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
import {
  clearInvalidations,
  insertChildSorted,
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
import { createLoadingItemData as adapterCreateLoadingItemData } from './adapters/treeItemAdapter';
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
  const queryTreeRef = useRef(queryTree);
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

  const tree = useTree<TreeNode>({
    rootItemId: rootId,
    indent, // AIDEV-NOTE: The library computes left offset per row from this indent; we keep row styles from item.getProps()
    getItemName: (item) => item.getItemData()?.label,
    isItemFolder: (item) => item.getItemData()?.kind === 'folder',
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
    // For saved QueryTree we currently support **file → folder** moves only. Folder moves and explicit
    // reordering will be layered on later once backend semantics are finalized.
    canDrag: (items) => items.length > 0,
    canDrop: (items, target) => {
      // AIDEV-NOTE: Disallow cross-section moves (cannot drag between different section roots).
      try {
        const draggedRoot = items[0]?.getTree?.()?.getRootItem?.()?.getId?.();
        const targetRoot = target.item?.getTree?.()?.getRootItem?.()?.getId?.();
        if (draggedRoot && targetRoot && draggedRoot !== targetRoot) return false;
      } catch {}

      const dragged = items[0];
      const targetItem = target.item;
      if (!dragged || !targetItem) return false;

      const isReorder = 'childIndex' in target && typeof target.childIndex === 'number';
      // AIDEV-NOTE: Reordering (drop between siblings) is out of scope for now; only allow drops
      // directly *onto* folders. This keeps the visual affordance aligned with the behaviors we
      // actually implement in useItemActions/handleDropMove.
      if (isReorder) return false;

      const draggedIsFolder = !!dragged.isFolder?.();
      const targetIsFolder = !!targetItem.isFolder?.();

      // AIDEV-NOTE: Initial scope: move files into folders only.
      if (draggedIsFolder) return false;
      if (!targetIsFolder) return false;

      return true;
    },
    openOnDropDelay: 250,
    onDrop: async (items, target) => {
      const dragged = items[0];
      const dragId = dragged?.getId?.();
      const dropTargetId = target.item?.getId?.();
      if (!dragId || !dropTargetId) return;
      const isTargetFolder = !('childIndex' in target && typeof target.childIndex === 'number');
      await actions.handleDropMove(dragId, dropTargetId, isTargetFolder);
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

    try { (tree as any).loadChildrenWithData?.(parentId); } catch {}
    try { (tree as any).loadChildrenIds?.(parentId); } catch {}
  }, [draftFolder?.nodeId, draftFolder?.parentId, draftFile?.nodeId, draftFile?.parentId, tree]);

  // AIDEV-NOTE: Row actions scoped to this section root
  const actions = useItemActions(tree as any, rootId, {
    onCreateFolderDraft: async () => {
      if (draftFolder) return;
      if (draftFile) return;
      const parentId  = rootId;
      const nodeId    = generateUUIDv7() as unknown as string;
      const folderId  = generateUUIDv7() as unknown as string;

      const draftNode: TreeNode = {
        nodeId       : nodeId as UUIDv7,
        parentNodeId : parentId,
        kind         : 'folder',
        label        : '',
        sortKey      : '',
        // AIDEV-NOTE: mountId is the canonical folder id (queryTreeFolderId), distinct from nodeId.
        mountId      : folderId as UUIDv7,
        level        : 1
      };

      // AIDEV-NOTE: Draft insertion is synchronous; prefer direct actions over a thunk
      // to avoid extra pending/fulfilled actions and reduce render churn.
      dispatch(upsertNode(draftNode));
      dispatch(insertChildSorted({ parentId, node: draftNode }));

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
      if (draftFolder) return;
      if (draftFile) return;

      const parentId    = rootId;
      const nodeId      = generateUUIDv7() as unknown as string;
      const dataQueryId = generateUUIDv7() as unknown as UUIDv7;

      const draftNode: TreeNode = {
        nodeId       : nodeId as unknown as UUIDv7,
        parentNodeId : parentId,
        kind         : 'file',
        label        : '',
        sortKey      : '',
        mountId      : dataQueryId,
        level        : 1
      };

      dispatch(upsertNode(draftNode));
      dispatch(insertChildSorted({ parentId, node: draftNode }));

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

  // AIDEV-NOTE: Stable callback to avoid breaking Row memo
  const handleTreeFocusFromRow = useCallback(() => setIsTreeFocused(true), []);

  // AIDEV-NOTE: Listen for mousedown outside the tree section to clear the focused state.
  // This is more robust than blur events which can fire unexpectedly during navigation.
  useEffect(() => {
    if (!isTreeFocused) return;

    const handleMouseDown = (e: MouseEvent) => {
      const section = sectionRef.current;
      if (!section) return;

      const target = e.target as Node | null;
      if (target && !section.contains(target)) {
        setIsTreeFocused(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, [isTreeFocused]);

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

  // Detect expanded state of section: root item is index 0
  const rootItem = allItems.find((it: any) => it?.getId?.() === rootId) || allItems[0];

  return (
    <section
      ref={sectionRef}
      className={styles['tree']}
      aria-label={label}
      data-open={isOpen ? 'true' : 'false'}
      data-row-focused={isTreeFocused ? 'true' : 'false'}
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
            disableNewFolder={(() => {
              try {
                const rootItemMeta = (rootItem as any)?.getItemMeta?.() ?? {};
                const rootLevel = (rootItemMeta.level ?? 0) as number;
                // AIDEV-NOTE: Block New Folder when a new child would be meta level >= 3 (aria-level >= 4)
                return rootLevel + 1 >= 3;
              } catch {}
              return false;
            })()}
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
                    onDropMove={actions.handleDropMove}
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
                          created = await dispatch(
                            createQueryFolderThunk({
                              parentFolderId: undefined,
                              name        : trimmed
                            })
                          ).unwrap();
                        } catch {
                          created = null;
                        }

                        if (created) {
                          dispatch(removeNode({ parentId, nodeId }));
                          setDraftFolder(null);
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
                          created = await dispatch(
                            createSavedQueryFileThunk({
                              dataQueryId,
                              name: trimmed
                            })
                          ).unwrap();
                        } catch {
                          created = null;
                        }

                        if (created) {
                          dispatch(removeNode({ parentId, nodeId }));
                          setDraftFile(null);
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
