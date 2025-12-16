'use client';

import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEY_QUERY_TREE_EXPANDED }  from '@Constants';


type ExpandedMap = Record<string, string[]>;

// AIDEV-NOTE: Module-level cache so we parse localStorage at most once per page load.
let cachedExpanded: ExpandedMap | null = null;

function normalizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const unique = new Set<string>();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    unique.add(s);
  }

  return Array.from(unique).sort();
}

function arraysEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function readExpanded(): ExpandedMap {
  if (cachedExpanded) return cachedExpanded;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUERY_TREE_EXPANDED);
    cachedExpanded = raw ? ((JSON.parse(raw) as ExpandedMap) ?? {}) : {};
  } catch {
    cachedExpanded = {};
  }
  return cachedExpanded!;
}

function writeExpanded(next: ExpandedMap) {
  cachedExpanded = next;
  try {
    localStorage.setItem(STORAGE_KEY_QUERY_TREE_EXPANDED, JSON.stringify(next));
  } catch {
    // AIDEV-NOTE: Ignore storage errors; expansion persistence is best-effort only.
  }
}

// Useful for tests or force-refresh scenarios
function invalidateExpandedFoldersCache() {
  cachedExpanded = null;
}

/**
 * AIDEV-NOTE: Persist expanded folder nodeIds per logical tree scope (e.g., "opspaceId:rootId").
 * Hydration-safe: returns null until localStorage has been read on the client.
 */
function useExpandedFoldersState(scopeId: string) {
  const [expanded, setExpandedState] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const all = readExpanded();
      const stored = all[scopeId];
      setExpandedState(normalizeIdList(stored));
    } catch {
      setExpandedState([]);
    }
  }, [scopeId]);

  const setExpanded = useCallback(
    (next: string[]) => {
      const normalized = normalizeIdList(next);
      setExpandedState((prev) => {
        // Hydration-safe: once hydrated, we only persist when the effective value changes.
        if (prev !== null && arraysEqual(prev, normalized)) {
          return prev;
        }

        try {
          const all = readExpanded();
          const existingRaw = all[scopeId];
          const existing = normalizeIdList(existingRaw);
          if (!arraysEqual(existing, normalized)) {
            const nextMap: ExpandedMap = { ...all };
            if (normalized.length === 0) {
              delete nextMap[scopeId];
            } else {
              nextMap[scopeId] = normalized;
            }
            writeExpanded(nextMap);
          }
        } catch {
          // AIDEV-NOTE: Ignore storage errors; do not block UI updates.
        }

        return normalized;
      });
    },
    [scopeId]
  );

  return { expanded, setExpanded } as const;
}


export {
  arraysEqual,
  invalidateExpandedFoldersCache,
  normalizeIdList,
  useExpandedFoldersState
};
