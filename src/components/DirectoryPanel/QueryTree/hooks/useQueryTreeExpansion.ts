'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';


type Args = {
  tree                        : unknown;
  rootId                      : string;
  scopeId                     : string;
  persistedExpandedFolders    : string[] | null;
  setPersistedExpandedFolders : (next: string[]) => void;
};

type Result = {
  ensureFolderExpanded: (folderNodeId: string) => Promise<void>;
};

function useQueryTreeExpansion({
  tree,
  rootId,
  scopeId,
  persistedExpandedFolders,
  setPersistedExpandedFolders
}: Args): Result {
  const expansionRestoreCompleteRef = useRef<boolean>(false);
  const lastScopeRef = useRef<string | null>(null);
  if (lastScopeRef.current !== scopeId) {
    lastScopeRef.current = scopeId;
    expansionRestoreCompleteRef.current = false;
  }

  const expandedItems = ((tree as any)?.getState?.()?.expandedItems || []) as string[];
  const expandedFolderIds = useMemo(() => {
    // AIDEV-NOTE: Preserve order and let the persistence hook normalize/sort. This avoids
    // double-sorting on every expand/collapse interaction.
    return (expandedItems || []).filter((id: string) => id !== rootId);
  }, [expandedItems, rootId]);

  // AIDEV-NOTE: Restore expanded folders from localStorage after hydration.
  // We set expandedItems directly so deep expansions work with async children.
  useEffect(() => {
    if (persistedExpandedFolders === null) return;
    // Once restored for this scope, do not keep re-applying state on every persisted update.
    if (expansionRestoreCompleteRef.current) return;

    // AIDEV-NOTE: persistedExpandedFolders is already normalized by the hook.
    const targetFolders         = persistedExpandedFolders.filter((id) => id !== rootId);
    const targetExpandedItems   = [rootId, ...targetFolders];
    const currentExpandedItems  = (((tree as any)?.getState?.()?.expandedItems || []) as string[]);

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
      (tree as any).setConfig((prev: any) => ({
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
    const currentSet = new Set(expandedFolderIds);
    const persistedSet = new Set<string>();
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
          const cur = ((tree as any)?.getState?.()?.expandedItems || []) as any;
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
            (tree as any).setConfig((prev: any) => {
              const prevState = prev.state || {};
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
  }, [rootId, tree]);

  return { ensureFolderExpanded };
}


export { useQueryTreeExpansion };
