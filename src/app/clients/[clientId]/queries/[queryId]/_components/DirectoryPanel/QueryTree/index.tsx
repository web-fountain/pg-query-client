'use client';

import type { NodePayload }             from './types';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTree }                      from '@headless-tree/react';
import {
  asyncDataLoaderFeature,
  selectionFeature,
  hotkeysCoreFeature
}                                       from '@headless-tree/core';

import {
  getItem,
  getChildrenWithData
}                                       from './api/fsClient';
import {
  getItemName as adapterGetItemName,
  isItemFolder as adapterIsItemFolder,
  createLoadingItemData as adapterCreateLoadingItemData
}                                       from './adapters/treeItemAdapter';
import { useInitialLoad }               from './hooks/useInitialLoad';
import { useItemActions }               from './hooks/useItemActions';
import { useVirtualizedTree }           from './hooks/useVirtualizedTree';
import Row                              from './components/Row';
import Toolbar                          from './components/Toolbar';

import styles                           from './styles.module.css';


function QueryTree({ rootId, indent = 24 }: { rootId: string; indent?: number }) {
  // AIDEV-NOTE: Debugging disabled in production
  // AIDEV-NOTE: Headless Tree instance with async data loader; names/folder state derive from cache.
  const tree = useTree<NodePayload>({
    rootItemId: rootId,
    indent,
    getItemName: (item) => adapterGetItemName(item),
    isItemFolder: (item) => adapterIsItemFolder(item),
    dataLoader: {
      getItem: async (id) => await getItem(id),
      getChildrenWithData: async (id) => await getChildrenWithData(id)
    },
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
    initialState: { expandedItems: [rootId], selectedItems: [rootId], focusedItem: rootId },
    createLoadingItemData: () => adapterCreateLoadingItemData() as unknown as NodePayload
  });

  const targetFolderId = useMemo(() => rootId, [rootId]);

  // AIDEV-NOTE: On mount/root change, load children for the root via dedicated hook.
  useInitialLoad(tree as any, rootId);

  // AIDEV-NOTE: Row actions and section-scoped toolbars. Bind actions per top-level folder id.
  const { handleRename, handleDropMove } = useItemActions(tree as any, targetFolderId);
  const actionsQueries   = useItemActions(tree as any, 'queries');
  const actionsServers   = useItemActions(tree as any, 'servers');
  const actionsProjects  = useItemActions(tree as any, 'projects_top');
  const actionsDatabases = useItemActions(tree as any, 'databases');

  // AIDEV-NOTE: Virtualize visible rows with fixed 28px height.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const { virtualizer, virtualItems } = useVirtualizedTree(tree as any, () => scrollerRef.current, 28, 8);
  // Ensure measure after mount in case scroll element attaches late
  useEffect(() => { try { virtualizer.measure(); } catch {} }, [virtualizer]);
  // AIDEV-NOTE: Track last input method (keyboard vs pointer) to avoid scroll jumps on mouse clicks
  const lastInputRef = useRef<'keyboard' | 'pointer'>('pointer');
  useEffect(() => {
    const onKey = () => { lastInputRef.current = 'keyboard'; };
    const onPointer = () => { lastInputRef.current = 'pointer'; };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('touchstart', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('touchstart', onPointer, true);
    };
  }, []);

  // AIDEV-NOTE: Focus sync – only for keyboard navigation to prevent jump on mouse clicks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [focusedTopId, setFocusedTopId] = useState<string | null>(null);
  (tree as any).onFocusedItemChange?.((focusedId: string | null) => {
    if (!focusedId) return;
    if (lastInputRef.current !== 'keyboard') return;
    const itemsNow = tree.getItems();
    const index = itemsNow.findIndex((it: any) => it.getId?.() === focusedId);
    if (index >= 0) {
      try { virtualizer.scrollToIndex(index, { align: 'auto' }); } catch {}
      // derive top-level id for focused row
      try {
        let currentTop: string | null = null;
        for (let i = 0; i < itemsNow.length; i++) {
          const it = itemsNow[i];
          const lvl = (it?.getItemMeta?.().level ?? 0) as number;
          if (lvl === 1) currentTop = it.getId?.() ?? null;
          if (i === index) break;
        }
        setFocusedTopId(currentTop);
      } catch {}
    }
  });

  // AIDEV-NOTE: Disable logic can be section-specific later; keep enabled for now.
  const disableNewFolder = false;

  // AIDEV-NOTE: Compute rendering ranges and items outside JSX to avoid TSX parsing quirks
  const allItems = (tree as any).getItems?.() ?? [];
  const vRanges = virtualizer.getVirtualItems();
  const renderRanges = vRanges.length ? vRanges : allItems.map((_: any, idx: number) => ({ key: idx, index: idx, start: idx * 28 }));
  const rowHeight = 28;
  const computedHeight = vRanges.length ? (virtualizer.getTotalSize() || allItems.length * rowHeight) : allItems.length * rowHeight;

  // AIDEV-NOTE: re-measure when count or container height changes
  useEffect(() => {
    try { virtualizer.measure(); } catch {}
  }, [virtualizer, allItems.length]);

  // AIDEV-NOTE: Anchor clicked row to avoid scroll jump; computed via virtualizer starts
  const handlePreToggle = useCallback((id?: string) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let targetScroll: number | null = null;
    const prevOverflowAnchor = (scroller.style as any)?.overflowAnchor;
    try { (scroller.style as any).overflowAnchor = 'none'; } catch {}
    // Compute pre values from virtualizer
    const itemsBefore = (tree as any).getItems?.() ?? [];
    const preIndex = id ? itemsBefore.findIndex((it: any) => it.getId?.() === id) : -1;
    const preRanges = virtualizer.getVirtualItems();
    const preRange = preRanges.find((r) => r.index === preIndex);
    const preStart = preRange ? preRange.start : (preIndex >= 0 ? preIndex * rowHeight : null);
    const preScrollTop = scroller.scrollTop;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Compute target scroll using virtualizer starts
        if (id && preStart != null) {
          const itemsNow = (tree as any).getItems?.() ?? [];
          const postIndex = itemsNow.findIndex((it: any) => it.getId?.() === id);
          const postRanges = virtualizer.getVirtualItems();
          const postRange = postRanges.find((r) => r.index === postIndex);
          const postStart = postRange ? postRange.start : (postIndex >= 0 ? postIndex * rowHeight : preStart);
          const delta = (postStart ?? 0) - (preStart ?? 0);
          // AIDEV-NOTE: Keep the clicked row under the cursor: invert delta
          targetScroll = preScrollTop - delta;
          try { scroller.scrollTop = targetScroll; } catch {}
          // Clamp scroll for a brief period to counter late adjustments
          const start = performance.now();
          const onScroll = () => {
            if (targetScroll == null) return;
            const drift = scroller.scrollTop - targetScroll;
            if (Math.abs(drift) > 1) {
              try { scroller.scrollTop = targetScroll; } catch {}
            }
            if (performance.now() - start > 220) {
              scroller.removeEventListener('scroll', onScroll, { capture: true } as any);
            }
          };
          scroller.addEventListener('scroll', onScroll, { capture: true } as any);
          setTimeout(() => {
            scroller.removeEventListener('scroll', onScroll, { capture: true } as any);
            targetScroll = null;
            try { (scroller.style as any).overflowAnchor = prevOverflowAnchor ?? ''; } catch {}
          }, 260);
        } else {
          // Restore overflow-anchor if we didn't compute a target
          try { (scroller.style as any).overflowAnchor = prevOverflowAnchor ?? ''; } catch {}
        }
      });
    });
  }, [tree, virtualizer]);

  // AIDEV-NOTE: bump overscan during drag, restore after
  useEffect(() => {
    const onStart = () => {
      try { (virtualizer as any).setOptions?.((opts: any) => ({ ...opts, overscan: Math.max(12, opts.overscan ?? 8) })); } catch {}
    };
    const onEnd = () => {
      try { (virtualizer as any).setOptions?.((opts: any) => ({ ...opts, overscan: 8 })); } catch {}
    };
    document.addEventListener('qt-drag-start', onStart as any);
    document.addEventListener('qt-drag-end', onEnd as any);
    return () => {
      document.removeEventListener('qt-drag-start', onStart as any);
      document.removeEventListener('qt-drag-end', onEnd as any);
    };
  }, [virtualizer]);

  return (
    <section className={styles['tree']} aria-label="Queries">
      {(() => {
        const containerProps = (tree as any).getContainerProps?.('Queries Tree') ?? {};
        const bridgeRef = (el: HTMLDivElement | null) => {
          scrollerRef.current = el;
          try {
            const r = (containerProps as any).ref;
            if (typeof r === 'function') r(el);
            else if (r && 'current' in r) (r as any).current = el;
          } catch {}
        };
        const mergedScrollerClass = `${containerProps.className ?? ''} ${styles['scroller']}`.trim();
        const mergedListClass = `${styles['list']}`;
        // AIDEV-NOTE: Build index→top-level mapping for sections
        const indexToTopId = new Map<number, string>();
        const topIdToIndex = new Map<string, number>();
        const TOP_LEVEL_IDS = new Set(['queries', 'servers', 'projects_top', 'databases']);
        let currentTop: string | null = null;
        for (let i = 0; i < allItems.length; i++) {
          const it: any = allItems[i];
          const id = it?.getId?.();
          if (id && TOP_LEVEL_IDS.has(id)) {
            currentTop = id;
            topIdToIndex.set(id, i);
            indexToTopId.set(i, id);
          } else if (currentTop) {
            indexToTopId.set(i, currentTop);
          }
        }

        const [hoveredTopId, setHoveredTopId] = (function() {
          // keep hovered state stable across renders
          const ref = (QueryTree as any)._hoverState || { get: null as string | null };
          (QueryTree as any)._hoverState = ref;
          const [val, setVal] = useState<string | null>(ref.get);
          useEffect(() => { ref.get = val; }, [val]);
          return [val, setVal] as const;
        })();
        const activeTopId = hoveredTopId; // active section is pointer-derived only
        const topIndex = activeTopId ? (topIdToIndex.get(activeTopId) ?? -1) : -1;
        const topRange = topIndex >= 0 ? vRanges.find((r) => r.index === topIndex) : undefined;
        const topStart: number | null = topIndex >= 0 ? (topRange ? topRange.start : topIndex * rowHeight) : null;
        const topItem = topIndex >= 0 ? allItems[topIndex] : null;
        const isTopExpanded = !!(topItem && (topItem as any).isExpanded?.());
        const lastActiveTopIdRef = useRef<string | null>(null);
        const lastTopStartRef = useRef<number>(0);
        if (activeTopId) lastActiveTopIdRef.current = activeTopId;
        if (topStart != null) lastTopStartRef.current = topStart;
        return (
          <div
            {...containerProps}
            ref={bridgeRef}
            className={mergedScrollerClass}
            data-scrollable
            onMouseLeave={() => {
              try { (setHoveredTopId as any)(null); } catch {}
            }}
            onMouseMove={(e) => {
              try {
                const scroller = scrollerRef.current;
                if (!scroller) return;
                const rect = scroller.getBoundingClientRect();
                const offsetY = e.clientY - rect.top + scroller.scrollTop;
                const approxIndex = Math.max(0, Math.min(allItems.length - 1, Math.floor(offsetY / rowHeight)));
                const topId = indexToTopId.get(approxIndex) ?? null;
                (setHoveredTopId as any)(topId);
              } catch {}
            }}
          >
            <div className={mergedListClass} style={{ height: computedHeight, width: '100%', position: 'relative' }}>
              {renderRanges.map((range: any) => {
                const it = allItems[range.index];
                if (!it) return null;
                const id = it.getId();
                return (
                  <div
                    key={range.key}
                    data-index={range.index}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${range.start}px)` }}
                  >
                    <Row
                      item={it}
                      indent={indent}
                      onRename={handleRename}
                      onDropMove={handleDropMove}
                      onPreToggle={handlePreToggle}
                    />
                  </div>
                );
              })}
              <div
                className={styles['section-toolbar']}
                style={{ transform: `translateY(${lastTopStartRef.current}px)` }}
                data-active-top-id={lastActiveTopIdRef.current || ''}
                data-visible={activeTopId && isTopExpanded ? 'true' : 'false'}
              >
                {(() => {
                  const map: Record<string, { onCreateFolder: () => void | Promise<void>; onCreateFile: () => void | Promise<void> }> = {
                    queries   : { onCreateFolder: actionsQueries.handleCreateFolder,   onCreateFile: actionsQueries.handleCreateFile },
                    servers   : { onCreateFolder: actionsServers.handleCreateFolder,   onCreateFile: actionsServers.handleCreateFile },
                    projects_top: { onCreateFolder: actionsProjects.handleCreateFolder, onCreateFile: actionsProjects.handleCreateFile },
                    databases : { onCreateFolder: actionsDatabases.handleCreateFolder, onCreateFile: actionsDatabases.handleCreateFile }
                  };
                  const idForHandlers = lastActiveTopIdRef.current || 'queries';
                  const handlers = map[idForHandlers] || map['queries'];
                  return (
                    <Toolbar
                      onCreateFolder={handlers.onCreateFolder}
                      onCreateFile={handlers.onCreateFile}
                      disableNewFolder={disableNewFolder}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}


export default QueryTree;
