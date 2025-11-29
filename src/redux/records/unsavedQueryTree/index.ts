import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState }     from '@Redux/store';
import type { UUIDv7 }        from '@Types/primitives';
import type {
  UnsavedQueryTreeNode,
  UnsavedQueryTreeRecord
}                             from './types';

import {
  createAction, createReducer,
  createSelector
}                             from '@reduxjs/toolkit';
import { DEFAULT_TAB_NAME }   from '@Constants';


function parseUntitledSuffix(name: string, base: string): number | null {
  if (name === base) return 1;
  // Must start with "Untitled " (single space)
  if (!name.startsWith(base) || name.length <= base.length + 1 || name.charCodeAt(base.length) !== 32) {
    return null;
  }
  let i = base.length + 1;
  let n = 0;
  let hasDigit = false;
  const len = name.length;
  while (i < len) {
    const code = name.charCodeAt(i);
    if (code < 48 || code > 57) return null; // non-digit => not our pattern
    hasDigit = true;
    n = n * 10 + (code - 48);
    i++;
  }
  if (!hasDigit || n <= 1) return null;
  return n;
}

// Action Creators
export const setInitialUnsavedQueryTree   = createAction<UnsavedQueryTreeRecord>          ('unsavedQueryTree/setInitialUnsavedQueryTree');
export const addUnsavedTreeNodeFromFetch  = createAction<{ tree: UnsavedQueryTreeNode }>  ('unsavedQueryTree/addUnsavedTreeNodeFromFetch');
export const removeUnsavedTreeNodeByTabId = createAction<{ tabId: UUIDv7 }>               ('unsavedQueryTree/removeUnsavedTreeNode');


// Selectors
export const selectUnsavedQueryTree = createSelector.withTypes<RootState>()(
  [(state) => state.unsavedQueryTree],
  (unsavedQueryTree) => unsavedQueryTree,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectUnsavedUntitledNumbers = createSelector.withTypes<RootState>()(
  [(state) => state.unsavedQueryTree.nodes],
  (nodes) => {
    const base = DEFAULT_TAB_NAME;
    const used = new Set<number>();
    // Avoid Object.values allocation; only consider file nodes
    // eslint-disable-next-line guard-for-in
    for (const id in nodes) {
      const node = (nodes as any)[id];
      if (!node || node.kind !== 'file') continue;
      const name = ((node.name as string) || '').trim();
      if (!name) continue;
      if (name === base) {
        used.add(1);
        continue;
      }
      const n = parseUntitledSuffix(name, base);
      if (n != null) used.add(n);
    }
    return used;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectNextUntitledName = createSelector.withTypes<RootState>()(
  [selectUnsavedUntitledNumbers],
  (used) => {
    if (!used.has(1)) return DEFAULT_TAB_NAME;
    // Smallest missing positive integer
    let n = 2;
    while (used.has(n)) n++;
    return `${DEFAULT_TAB_NAME} ${n}`;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);


// Reducer
const initialState: UnsavedQueryTreeRecord = {
  rootId: 'unsaved-root',
  nodes: {},
  childrenByParentId: {}
};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setInitialUnsavedQueryTree,
      function(state: UnsavedQueryTreeRecord, action: PayloadAction<UnsavedQueryTreeRecord>) {
        Object.assign(state, action.payload);
      }
    )
    .addCase(addUnsavedTreeNodeFromFetch,
      function(state : UnsavedQueryTreeRecord, action: PayloadAction<{ tree: UnsavedQueryTreeNode }>) {
        const { tree } = action.payload;
        const { nodeId, parentNodeId } = tree;

        state.nodes[nodeId] = tree;

        const children = state.childrenByParentId[parentNodeId];
        if (!children) {
          state.childrenByParentId[parentNodeId] = [nodeId];
        } else {
          children.push(nodeId);
        }
      }
    )
    .addCase(removeUnsavedTreeNodeByTabId,
      function (state: UnsavedQueryTreeRecord, action: PayloadAction<{ tabId: UUIDv7 }>) {
        const { tabId } = action.payload;
        const node = state.nodes[tabId];
        if (!node) return;

        const parentKey = String(node.parentNodeId);
        const children = state.childrenByParentId[parentKey] || [];

        state.childrenByParentId[parentKey] = children.filter((id) => id !== node.nodeId);
        delete state.nodes[tabId];
      }
    )
});
