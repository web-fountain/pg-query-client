'use client';

import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY_TREE_SECTIONS }        from '@Constants';


type TreeSectionState = Record<string, boolean>;

// Module-level cache so we parse localStorage at most once per page load
let cachedTreeSections: TreeSectionState | null = null;

function readTreeSections(): TreeSectionState {
  if (cachedTreeSections) return cachedTreeSections;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TREE_SECTIONS);
    cachedTreeSections = raw ? (JSON.parse(raw) as TreeSectionState) ?? {} : {};
  } catch {
    cachedTreeSections = {};
  }

  return cachedTreeSections!;
}

function writeTreeSections(next: TreeSectionState) {
  cachedTreeSections = next;
  try {
    localStorage.setItem(STORAGE_KEY_TREE_SECTIONS, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
}

// Useful for tests or force-refresh scenarios
function invalidateTreeSectionsCache() {
  cachedTreeSections = null;
}

/**
 * AIDEV-NOTE: Persists section expand/collapse state to localStorage.
 * Uses a module-level cache to parse localStorage at most once per page load.
 * Hydration-safe: defaults to `defaultOpen` until localStorage is read.
 */
function useTreeSectionState(sectionId: string, defaultOpen = true) {
  // SSR and first client render are always `defaultOpen`
  const [isOpen, setIsOpenInternal] = useState<boolean>(defaultOpen);

  // Hydrate from cached localStorage after mount (client-only, after hydration)
  useEffect(() => {
    try {
      const all = readTreeSections();
      const stored = all[sectionId];
      if (typeof stored === 'boolean') {
        setIsOpenInternal(stored);
      }
    } catch {
      // Ignore and keep default
    }
  }, [sectionId]);

  // Persist to localStorage when state changes
  const setIsOpen = useCallback(
    (nextOrUpdater: boolean | ((prev: boolean) => boolean)) => {
      setIsOpenInternal(prev => {
        const next =
          typeof nextOrUpdater === 'function'
            ? (nextOrUpdater as (p: boolean) => boolean)(prev)
            : nextOrUpdater;

        // No change, skip work
        if (next === prev) return prev;

        try {
          const all = { ...readTreeSections(), [sectionId]: next };
          writeTreeSections(all);
        } catch {
          // Ignore storage errors
        }

        return next;
      });
    },
    [sectionId],
  );

  return { isOpen, setIsOpen } as const;
}

export {
  invalidateTreeSectionsCache,
  useTreeSectionState
};
