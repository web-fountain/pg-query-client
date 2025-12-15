'use client';

import type { QueryTreeRecord, TreeNode } from '@Redux/records/queryTree/types';
import type { UUIDv7 }                    from '@Types/primitives';

import {
  useCallback, useEffect, useRef,
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
  selectQueryTree,
  clearInvalidations
}                                         from '@Redux/records/queryTree';
import { getQueryTreeNodeChildrenThunk }  from '@Redux/records/queryTree/thunks';
import {
  selectActiveTabId,
  selectTabIdByMountIdMap,
}                                         from '@Redux/records/tabbar';
import Icon                               from '@Components/Icons';

import { useTreeSectionState }            from '../hooks/useTreeSectionState';
import { useItemActions }                 from './hooks/useItemActions';
import Row                                from './components/Row';
import Toolbar                            from './components/Toolbar';
import { createLoadingItemData as adapterCreateLoadingItemData } from './adapters/treeItemAdapter';

import styles                             from './styles.module.css';


// AIDEV-NOTE: Outer wrapper to remount the hook-owned tree instance on Redux changes.
// Only remount on node count changes (add/delete). Renames and reordering are handled
// by surgical invalidation in QueriesTreeInner via pendingInvalidations.
function QueriesTree(props: { rootId: string; indent?: number; label?: string }) {
  const { isOpen, setIsOpen } = useTreeSectionState(props.rootId, true);
  const queryTree             = useReduxSelector(selectQueryTree);

  const nodeCount = Object.keys(queryTree.nodes || {}).length;
  const resetKey  = `${props.rootId}:${nodeCount}`;

  return <QueriesTreeInner key={resetKey} queryTree={queryTree} isOpen={isOpen} setIsOpen={setIsOpen} {...props} />;
}

function QueriesTreeInner(
  { rootId, indent = 20, label = 'QUERIES', queryTree, isOpen, setIsOpen }:
  { rootId: string; indent?: number; label?: string; queryTree: QueryTreeRecord; isOpen: boolean; setIsOpen: (v: boolean | ((prev: boolean) => boolean)) => void; }
) {
  const dispatch      = useReduxDispatch();

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
    canDrag: (items) => items.length > 0,
    canDrop: (items, target) => {
      // AIDEV-NOTE: Disallow cross-section moves
      try {
        const draggedRoot = items[0]?.getTree?.()?.getRootItem?.()?.getId?.();
        const targetRoot = target.item?.getTree?.()?.getRootItem?.()?.getId?.();
        if (draggedRoot && targetRoot && draggedRoot !== targetRoot) return false;
      } catch {}

      const isReorder = 'childIndex' in target && typeof target.childIndex === 'number';
      // Base allowance: reorder within same parent OR drop into a folder
      let allowed = isReorder ? true : target.item?.isFolder?.() === true;
      if (!allowed) return false;

      // AIDEV-NOTE: Enforce depth rule: no folders at aria-level >= 4 (meta level >= 3)
      try {
        const parentItem = target.item;
        const parentLevel = (parentItem?.getItemMeta?.()?.level ?? 0) as number;
        const newLevel = parentLevel + 1; // child meta level
        const draggedIsFolder = !!items[0]?.isFolder?.();
        if (draggedIsFolder && newLevel >= 3) return false;
      } catch {}

      return allowed;
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

  // AIDEV-NOTE: Row actions scoped to this section root
  const actions = useItemActions(tree as any, rootId);

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
