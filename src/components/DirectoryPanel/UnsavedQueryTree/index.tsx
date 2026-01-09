'use client';

import type {
  UnsavedQueryTreeRecord, UnsavedTreeNode
}                                               from '@Redux/records/unsavedQueryTree/types';

import {
  useCallback, useEffect, useMemo, useRef,
  useState, useTransition
}                                               from 'react';
import {
  usePathname, useParams,
  useRouter
}                                               from 'next/navigation';
import { useTree }                              from '@headless-tree/react';
import {
  syncDataLoaderFeature, selectionFeature,
  hotkeysCoreFeature, dragAndDropFeature
}                                               from '@headless-tree/core';
import { canCreateFolderChildAtParentMetaLevel } from '@Redux/records/queryTree/constraints';
import {
  useReduxDispatch, useReduxSelector
}                                               from '@Redux/storeHooks';
import {
  selectUnsavedQueryTree, selectNextUntitledName
}                                               from '@Redux/records/unsavedQueryTree';
import { selectActiveTabId, selectTabIds }      from '@Redux/records/tabbar';
import { createNewUnsavedDataQueryThunk }       from '@Redux/records/dataQuery/thunks';
import { closeAllUnsavedTabsThunk }             from '@Redux/records/tabbar/thunks';
import { generateUUIDv7 }                       from '@Utils/generateId';
import Icon                                     from '@Components/Icons';

import { useTreeSectionState }                  from '../hooks/useTreeSectionState';
import Row                                      from './components/Row';
import Toolbar                                  from './components/Toolbar';

import styles                                   from './styles.module.css';


// AIDEV-NOTE: Outer wrapper to remount the hook-owned tree instance on Redux changes.
// AIDEV-NOTE: We continue to rely on a reset key here to avoid subtle cache issues inside headless-tree.
function UnsavedQueryTree(props: { rootId: string; label: string; indent?: number }) {
  const { isOpen, setIsOpen } = useTreeSectionState(props.rootId, false);
  const unsavedQueryTree      = useReduxSelector(selectUnsavedQueryTree);

  const nodeCount = Object.keys(unsavedQueryTree.nodes || {}).length;
  const edgeCount = Object.keys(unsavedQueryTree.childrenByParentId || {}).length;
  const resetKey = `${props.rootId}:${nodeCount}:${edgeCount}`;

  return <UnsavedQueriesTreeInner key={resetKey} unsavedQueryTree={unsavedQueryTree} isOpen={isOpen} setIsOpen={setIsOpen} {...props} />;
}

function UnsavedQueriesTreeInner(
  { rootId, indent = 20, label = 'UNSAVED QUERIES', unsavedQueryTree, isOpen, setIsOpen }:
  { rootId: string; indent?: number; label: string; unsavedQueryTree: UnsavedQueryTreeRecord; isOpen: boolean; setIsOpen: (v: boolean | ((prev: boolean) => boolean)) => void; }
) {
  const tabIds              = useReduxSelector(selectTabIds);
  const activeTabId         = useReduxSelector(selectActiveTabId);
  const nextUntitledName    = useReduxSelector(selectNextUntitledName);
  const pathname            = usePathname();
  const dispatch            = useReduxDispatch();
  const { opspaceId }       = useParams<{ opspaceId: string }>()!;
  const router              = useRouter();
  const [
    isCreatePending,
    startCreateTransition
  ]                         = useTransition();
  // AIDEV-NOTE: Only treat unsaved rows as "active from tabbar" when the QueryWorkspace route is mounted.
  // On the opspace landing page (/opspace/{id}) we always want a click to navigate.
  const isOnQueriesRoute = (pathname || '').split('/').filter(Boolean).includes('queries');

  const handleCreateFile = useCallback(() => {
    if (isCreatePending) return;

    // AIDEV-NOTE: Mirror CreateNewQueryButton semantics, but wrap in a transition so the UI
    // can remain responsive and the toolbar button reflects a pending state.
    startCreateTransition(() => {
      const dataQueryId = generateUUIDv7();
      dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));
      try {
        router.replace(`/opspace/${opspaceId}/queries/new`);
      } catch {}
    });
  }, [dispatch, nextUntitledName, opspaceId, router, isCreatePending, startCreateTransition]);

  const handleCloseAll = useCallback(async () => {
    // AIDEV-NOTE: Close all unsaved queries via bulk thunk that delegates to closeTabThunk.
    try {
      await dispatch(closeAllUnsavedTabsThunk());
    } catch (e: any) {
      if (typeof window !== 'undefined') {
        window.alert(e?.message || 'Close all failed');
      }
    }
  }, [dispatch]);

  const handleDropMove = useCallback(async (_dragId: string, _dropTargetId: string, _isTargetFolder: boolean) => {
    // AIDEV-TODO: Implement drag-and-drop reordering for UnsavedQueryTree backed by Redux.
    return;
  }, []);

  // AIDEV-NOTE: Derive unsaved group metadata from the current tree snapshot.
  const allGroupNodeIds = Object.values(unsavedQueryTree.nodes || {})
    .filter((node) => node && node.kind === 'group')
    .map((node) => node.nodeId);
  const rootChildrenIds = unsavedQueryTree.childrenByParentId[rootId] || [];
  const rootGroupIds = rootChildrenIds.filter((childId) => {
    const node = unsavedQueryTree.nodes[childId];
    return node && node.kind === 'group';
  });
  const groupCount = rootGroupIds.length;
  const hasMultipleGroups = groupCount > 1;
  const singleGroupId = groupCount === 1 ? rootGroupIds[0] : null;

  // AIDEV-NOTE: Sync unsaved tree highlight with the active tab (not the roving focus index).
  // Users expect the highlighted node to remain highlighted until another tab is selected.
  const activeUnsavedNodeId = useMemo(() => {
    if (!activeTabId) return null;
    const node = unsavedQueryTree.nodes[String(activeTabId)];
    if (node && node.kind === 'file') {
      return node.nodeId;
    }

    return null;
  }, [activeTabId, unsavedQueryTree.nodes]);

  // AIDEV-NOTE: Memoized tree configuration to keep item props and handlers stable where possible.
  const treeConfig = useMemo(() => ({
    rootItemId: rootId,
    indent, // AIDEV-NOTE: Indentation applied by library on each row via item props style
    getItemName: (item: any) => item.getItemData()?.name,
    isItemFolder: (item: any) => item.getItemData()?.kind === 'group',
        // AIDEV-NOTE: All data is present synchronously; syncDataLoaderFeature wires dataLoader into the tree.
        features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature],
    dataLoader: {
      // AIDEV-NOTE: Unsaved tree data is fully local from Redux; use synchronous loader.
      getItem: (nodeId: string) => unsavedQueryTree.nodes[nodeId],
      getChildren: (nodeId: string) => unsavedQueryTree.childrenByParentId[nodeId] || []
    },
    // AIDEV-NOTE: Expanded root and all groups so folders appear open and cannot be collapsed via UI controls.
    // AIDEV-NOTE: Combined with the hydration reload + invalidate below, this avoids the library sticking to an initial "empty" cache.
    initialState: { expandedItems: [rootId, ...allGroupNodeIds], selectedItems: [rootId], focusedItem: rootId },
    // AIDEV-NOTE: DnD configuration per headless-tree docs: https://headless-tree.lukasbach.com/features/dnd/
    canDrag: (items: any[]) => items.length > 0,
    canDrop: (items: any[], target: any) => {
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
        const draggedIsFolder = !!items[0]?.isFolder?.();
        if (draggedIsFolder && !canCreateFolderChildAtParentMetaLevel(parentLevel)) return false;
      } catch {}

      return allowed;
    },
    openOnDropDelay: 250,
    onDrop: async (items: any[], target: any) => {
      const dragged = items[0];
      const dragId = dragged?.getId?.();
      const dropTargetId = target.item?.getId?.();
      if (!dragId || !dropTargetId) return;
      const isTargetFolder = !('childIndex' in target && typeof target.childIndex === 'number');
      await handleDropMove(dragId, dropTargetId, isTargetFolder);
    }
  }), [rootId, indent, unsavedQueryTree, allGroupNodeIds, handleDropMove]);

  const tree = useTree<UnsavedTreeNode>(treeConfig);

  // AIDEV-NOTE: Ref for scroll host (used for scrollbar gutter detection).
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Track whether the tree (scroller) currently contains focus
  const [isTreeFocused, setIsTreeFocused] = useState<boolean>(false);

  // Compute rendering ranges and items outside JSX
  const allItems = (tree as any).getItems?.() ?? [];
  // AIDEV-NOTE: Baseline diagnostic — disable custom virtualization, render all items.
  // AIDEV-NOTE: When only a single group exists under the root, flatten it by hiding its row.
  // AIDEV-NOTE: Additionally, mirror unsaved file row order to the TabBar tabIds for a single-group layout.
  const renderItems = useMemo(() => {
    const filtered = allItems.filter((it: any) => {
      const id = it?.getId?.();
      if (!id) return false;
      // Always hide the internal root row
      if (id === rootId) return false;
      if (!hasMultipleGroups && singleGroupId) {
        const data = (it as any).getItemData?.() as UnsavedTreeNode | undefined;
        if (data && data.kind === 'group' && data.nodeId === singleGroupId) return false;
      }
      return true;
    });

    if (!tabIds || tabIds.length === 0) {
      return filtered;
    }

    // For now we only reorder when there is a single unsaved group under the root.
    if (hasMultipleGroups || !singleGroupId) {
      return filtered;
    }

    const tabIndexById = new Map<string, number>();
    (tabIds as string[]).forEach((id, idx) => {
      tabIndexById.set(id, idx);
    });

    const nodes = unsavedQueryTree.nodes || {};

    return filtered.slice().sort((a: any, b: any) => {
      const aId = String(a?.getId?.() ?? '');
      const bId = String(b?.getId?.() ?? '');
      const aNode = nodes[aId] as UnsavedTreeNode | undefined;
      const bNode = nodes[bId] as UnsavedTreeNode | undefined;

      const aIsFile = !!aNode && aNode.kind === 'file';
      const bIsFile = !!bNode && bNode.kind === 'file';

      if (!aIsFile && !bIsFile) return 0;
      if (!aIsFile && bIsFile) return -1;
      if (aIsFile && !bIsFile) return 1;

      const ai = tabIndexById.get(aId);
      const bi = tabIndexById.get(bId);

      if (ai == null && bi == null) return 0;
      if (ai == null) return 1;
      if (bi == null) return -1;
      return ai - bi;
    });
  }, [allItems, rootId, hasMultipleGroups, singleGroupId, tabIds, unsavedQueryTree.nodes]);

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
      className={styles['tree']}
      aria-label={label}
      data-open={isOpen ? 'true' : 'false'}
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
            onCreateFile={handleCreateFile}
            onCloseAll={handleCloseAll}
            disableCloseAll={renderItems.length === 0}
            isCreatePending={isCreatePending}
            disableCreateReason="Connect a server to create a new query"
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
        const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
          try { containerOnBlur?.(e as any); } catch {}
          try {
            const current = e.currentTarget as HTMLElement;
            const next = e.relatedTarget as Node | null;
            if (!next || !current.contains(next)) setIsTreeFocused(false);
          } catch {}
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
              {renderItems.map((item: any) => (
                <Row
                  key={item.getId()}
                  item={item}
                  indent={indent}
                  onDropMove={handleDropMove}
                  isTreeFocused={isTreeFocused}
                  isTopLevel={false}
                  isActiveFromTab={
                    isOnQueriesRoute &&
                    activeUnsavedNodeId !== null &&
                    item.getId() === activeUnsavedNodeId
                  }
                />
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}


export default UnsavedQueryTree;
