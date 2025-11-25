'use client';

import type { TreeNode }                from '@Redux/records/queryTree/types';
import type { QueryTreeRecord }         from '@Redux/records/queryTree/types';

import { useRef, useEffect, useState }  from 'react';
import { useTree }                      from '@headless-tree/react';
import {
  asyncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature,
  dragAndDropFeature
}                                       from '@headless-tree/core';
import {
  useReduxSelector,
  useReduxDispatch
}                                       from '@Redux/storeHooks';
import {
  selectQueryTree,

}                                         from '@Redux/records/queryTree';
import { getQueryTreeNodeChildrenThunk }  from '@Redux/records/queryTree/thunks';

import Icon                               from '@Components/Icons';

import {

  createLoadingItemData as adapterCreateLoadingItemData
}                                       from './adapters/treeItemAdapter';
import { useItemActions }               from './hooks/useItemActions';
import Row                              from './components/Row';
import Toolbar                          from './components/Toolbar';

import styles                           from './styles.module.css';


// AIDEV-NOTE: Outer wrapper to remount the hook-owned tree instance on Redux changes
function QueriesTree(props: { rootId: string; indent?: number; label?: string }) {
  const { rootId } = props;
  const queryTree = useReduxSelector(selectQueryTree);
  const resetKey = `${rootId}:${Object.keys(queryTree?.nodes || {}).length}:${((queryTree?.childrenByParentId?.[rootId]) || []).length}`;
  return <QueriesTreeInner key={resetKey} queryTree={queryTree} {...props} />;
}

function QueriesTreeInner(
  { rootId, indent = 20, label = 'QUERIES', queryTree }:
  { rootId: string; indent?: number; label?: string; queryTree: QueryTreeRecord }
) {
  const dispatch      = useReduxDispatch();

  const tree = useTree<TreeNode>({
    rootItemId: rootId,
    indent, // AIDEV-NOTE: The library computes left offset per row from this indent; we keep row styles from item.getProps()
    getItemName: (item) => item.getItemData()?.label,
    isItemFolder: (item) => item.getItemData()?.kind === 'folder',
    dataLoader: {
      getItem: async (nodeId) => {
        const item = queryTree?.nodes?.[nodeId];
        return item as TreeNode;
      },
      getChildrenWithData: async (nodeId) => {
        const childrenNodeIds = queryTree?.childrenByParentId?.[nodeId];

        // If children are already in the tree, return them
        if (childrenNodeIds !== undefined) {
          const rows = (childrenNodeIds || []).map((cid: string) => ({ id: cid, data: queryTree.nodes[cid] }));
          return rows as { id: string; data: TreeNode }[];
        }

        // AIDEV-NOTE: Children not present — fetch from backend for this node (including root).
        const children = await dispatch(getQueryTreeNodeChildrenThunk({ nodeId })).unwrap();
        return (children || []).map((cid: TreeNode) => ({ id: cid.nodeId, data: cid })) as { id: string; data: TreeNode }[];
      }
    },
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature],
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

  // AIDEV-NOTE: Ref for scroll host (used for scrollbar gutter detection).
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Track whether the tree (scroller) currently contains focus
  const [isTreeFocused, setIsTreeFocused] = useState<boolean>(false);
  // AIDEV-NOTE: Section open/closed UI state (decoupled from Tree's root expansion)
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // Compute rendering ranges and items outside JSX
  const allItems = (tree as any).getItems?.() ?? [];
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
            onCreateFolder={actions.handleCreateFolder}
            onCreateFile={actions.handleCreateFile}
            disableNewFolder={(() => {
              try {
                const rootItemMeta = (rootItem as any)?.getItemMeta?.() ?? {};
                const rootLevel = (rootItemMeta.level ?? 0) as number;
                // AIDEV-NOTE: Block New Folder when a new child would be meta level >= 3 (aria-level >= 4)
                return rootLevel + 1 >= 3;
              } catch {}
              return false;
            })()}
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
              {renderItems.map((it: any) => (
                <Row
                  key={it.getId()}
                  item={it}
                  indent={indent}
                  onRename={actions.handleRename}
                  onDropMove={actions.handleDropMove}
                  isTreeFocused={isTreeFocused}
                  isTopLevel={false}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}


export default QueriesTree;
