import { useEffect } from 'react';

// AIDEV-NOTE: Narrowed Tree API surface used by the initial-load effect.
type LoadableTree = {
  loadChildrenIds: (id: string) => void;
};

type OptionalTree = LoadableTree & {
  // AIDEV-NOTE: Avoid tight coupling to library internals using optional chaining patterns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export function useInitialLoad(tree: OptionalTree, rootId: string) {
  useEffect(() => {
    try { (tree as any).loadItemData?.(rootId); } catch {}
    // Prefer children-with-data loader when available to hydrate rows in one pass
    try {
      if ((tree as any).loadChildrenWithData) {
        (tree as any).loadChildrenWithData(rootId);
      } else {
        tree.loadChildrenIds(rootId);
      }
    } catch {
      try { tree.loadChildrenIds(rootId); } catch {}
    }
    try { (tree as any).getItem?.(rootId)?.expand?.(); } catch {}
  }, [tree, rootId]);
}
