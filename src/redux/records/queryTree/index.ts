import type { PayloadAction }                   from '@reduxjs/toolkit';
import type { RootState }                       from '@Redux/store';
import type { UUIDv7 }                          from '@Types/primitives';
import type {
  PendingInvalidations,
  QueryTreeRecord,
  TreeNode
}                                               from './types';

import {
  createAction, createReducer,
  createSelector
}                                               from '@reduxjs/toolkit';

import { fsSortKeyEn }                          from '@Utils/collation';
import { compareBySortKey, findInsertIndexIds } from './sort';


// Action Creators
export const setInitialQueryTree = createAction<QueryTreeRecord> ('queryTree/setInitialQueryTree');
export const setQueryTree = createAction<QueryTreeRecord> ('queryTree/setQueryTree');
export const setChildren  = createAction<{ parentId: string; rows: TreeNode[] }>   ('queryTree/setChildren');
export const upsertNode   = createAction<TreeNode>                                    ('queryTree/upsertNode');
export const addChild     = createAction<{ parentId: string; node: TreeNode }>        ('queryTree/addChild');
export const moveNode     = createAction<{ nodeId: string; oldParentNodeId: string; newParentNodeId: string; index?: number }>('queryTree/moveNode');
export const resortChildren      = createAction<{ parentId: string }>('queryTree/resortChildren');
export const insertChildSorted   = createAction<{ parentId: string; node: TreeNode }>('queryTree/insertChildSorted');

// AIDEV-NOTE: Explicitly link a dataQueryId to a tree nodeId so renameNodeWithInvalidation
// can locate the correct node even for client-created nodes (e.g., promotions).
export const linkDataQueryIdToNodeIds = createAction<{
  dataQueryId : UUIDv7;
  nodeId      : UUIDv7;
}>('queryTree/linkDataQueryIdToNodeIds');

// AIDEV-NOTE: Rename with automatic resort detection and invalidation tracking.
// This action updates the label, computes if resort is needed, and sets pendingInvalidations.
export const renameNodeWithInvalidation = createAction<{
  dataQueryId : UUIDv7;
  name        : string;
}>('queryTree/renameNodeWithInvalidation');

// AIDEV-NOTE: Clear invalidations after processing (pass what was processed to avoid races).
export const clearInvalidations = createAction<{
  items   : string[];
  parents : string[];
}>('queryTree/clearInvalidations');

// Selectors
export const selectChildrenWithData = createSelector.withTypes<RootState>()(
  [
    (state: RootState, parentId: string) => parentId,
    (state: RootState) => state.queryTree ],
  (parentId, tree) => {
    const ids = tree.childrenByParentId[parentId] || [];
    return ids.map((id: string) => ({ id, data: tree.nodes[id] }));
  }
);

export const selectItem = createSelector.withTypes<RootState>()(
  [
    (_state: RootState, nodeId: UUIDv7) => nodeId,
    (state: RootState) => state.queryTree.nodes
  ],
  (nodeId, nodes) => nodes[nodeId]
);

export const selectQueryTree = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.queryTree],
  (queryTree): QueryTreeRecord => queryTree,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectItemLabel = createSelector.withTypes<RootState>()(
  [
    (_state: RootState, nodeId: UUIDv7) => nodeId,
    (state: RootState) => state.queryTree.nodes
  ],
  (nodeId, nodes) => nodes[nodeId]?.label
);

// Reducer
const initialState: QueryTreeRecord = {
  nodes                 : {},
  childrenByParentId    : {},
  nodeIdsByFolderId     : {},
  nodeIdsByDataQueryId  : {}
};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setInitialQueryTree,
      function (state: QueryTreeRecord, action: PayloadAction<QueryTreeRecord>) {
        Object.assign(state, action.payload);
        // AIDEV-NOTE: Clear stale invalidations on full hydration — server data is source of truth
        state.pendingInvalidations = undefined;
      }
    )
    .addCase(setQueryTree,
      function (state: QueryTreeRecord, action: PayloadAction<QueryTreeRecord>) {
        Object.assign(state, action.payload);
        // AIDEV-NOTE: Clear stale invalidations on full hydration — server data is source of truth
        state.pendingInvalidations = undefined;
      }
    )
    .addCase(setChildren,
      function (state: QueryTreeRecord, action: PayloadAction<{ parentId: string; rows: TreeNode[] }>) {
        const { parentId, rows } = action.payload;
        const ids: string[] = [];

        for (const r of rows) {
          state.nodes[r.nodeId] = { ...r, parentNodeId: parentId } as TreeNode;
          ids.push(r.nodeId as string);
        }

        state.childrenByParentId[parentId] = ids;
      }
    )
    .addCase(upsertNode,
      function (state: QueryTreeRecord, action: PayloadAction<TreeNode>) {
        const { nodeId } = action.payload;
        const cur = state.nodes[nodeId];
        state.nodes[nodeId] = { ...(cur || {}), ...action.payload };
      }
    )
    .addCase(addChild,
      function (state: QueryTreeRecord, action: PayloadAction<{ parentId: string; node: TreeNode }>) {
        const { parentId, node } = action.payload;
        state.nodes[node.nodeId] = { ...node, parentNodeId: parentId };
        const arr = state.childrenByParentId[parentId] || [];
        if (!arr.includes(node.nodeId)) arr.push(node.nodeId);
        state.childrenByParentId[parentId] = arr;
      }
    )
    .addCase(moveNode,
      function (state: QueryTreeRecord, action: PayloadAction<{ nodeId: string; oldParentNodeId: string; newParentNodeId: string; index?: number }>) {
        const { nodeId, oldParentNodeId, newParentNodeId, index } = action.payload;
        const oldArr = state.childrenByParentId[oldParentNodeId] || [];
        state.childrenByParentId[oldParentNodeId] = oldArr.filter((x: string) => x !== nodeId);
        const newArr = state.childrenByParentId[newParentNodeId] || [];
        if (index !== undefined) newArr.splice(index, 0, nodeId); else newArr.push(nodeId);
        state.childrenByParentId[newParentNodeId] = newArr;
        if (state.nodes[nodeId]) state.nodes[nodeId].parentNodeId = newParentNodeId;
      }
    )
    // AIDEV-NOTE: Re-sort a parent's children by sortKey/name to reflect rename operations
    .addCase(resortChildren,
      function (state: QueryTreeRecord, action: PayloadAction<{ parentId: string }>) {
        const { parentId } = action.payload;
        const ids = (state.childrenByParentId[parentId] || []).slice();
        const resolve = (id: string) => {
          const n = state.nodes[id];
          return { nodeId: id, kind: (n?.kind || 'file') as 'folder' | 'file', name: n?.label || '', sortKey: n?.sortKey };
        };
        ids.sort((a, b) => compareBySortKey(resolve(a), resolve(b)));
        state.childrenByParentId[parentId] = ids;
      }
    )
    .addCase(insertChildSorted,
      function (state: QueryTreeRecord, action: PayloadAction<{ parentId: string; node: TreeNode }>) {
        const { parentId, node } = action.payload;
        state.nodes[node.nodeId] = { ...node, parentNodeId: parentId };
        const arr = state.childrenByParentId[parentId] || [];

        const resolve = (id: string) => {
          const n = state.nodes[id];
          return { nodeId: id, kind: (n?.kind || 'file') as 'folder' | 'file', name: n?.label || '', sortKey: n?.sortKey };
        };

        const idx = findInsertIndexIds(arr, resolve(node.nodeId), resolve, compareBySortKey);
        if (!arr.includes(node.nodeId as UUIDv7)) arr.splice(idx, 0, node.nodeId as UUIDv7);
        state.childrenByParentId[parentId] = arr;
      }
    )
    .addCase(linkDataQueryIdToNodeIds,
      function (state: QueryTreeRecord, action: PayloadAction<{ dataQueryId: UUIDv7; nodeId: UUIDv7 }>) {
        const { dataQueryId, nodeId } = action.payload;
        const existing = state.nodeIdsByDataQueryId[dataQueryId] || [];
        if (!existing.includes(nodeId)) {
          state.nodeIdsByDataQueryId[dataQueryId] = [...existing, nodeId];
        }
      }
    )
    // AIDEV-NOTE: Rename with automatic resort detection and invalidation tracking.
    // Computes if the rename causes a sort order change and sets pendingInvalidations.
    .addCase(renameNodeWithInvalidation,
      function (state: QueryTreeRecord, action: PayloadAction<{ dataQueryId: UUIDv7; name: string }>) {
        const { dataQueryId, name } = action.payload;

        const nodeId = state.nodeIdsByDataQueryId?.[dataQueryId]?.[0];
        if (!nodeId) return;

        const node = state.nodes[nodeId];
        if (!node) return;

        const parentId = node.parentNodeId as UUIDv7;

        // Update the label
        node.label = name;

        // AIDEV-NOTE: Update sortKey to match new name. Format: kind|numeric_sortable_label|nodeId
        // Uses fsSortKeyEn to produce lowercase, zero-padded label matching backend's fs_sortkey_en.
        // This is critical for compareBySortKey to detect sort order changes.
        if (node.sortKey) {
          const parts = node.sortKey.split('|');
          if (parts.length >= 3) {
            // Reconstruct sortKey: kind_indicator|numeric_sortable_label|node_id
            parts[1] = fsSortKeyEn(name);
            node.sortKey = parts.join('|');
          }
        }

        // Initialize pending invalidations if needed
        if (!state.pendingInvalidations) {
          state.pendingInvalidations = { items: [], parents: [] };
        }

        // Always invalidate the item's data (for label display in headless-tree)
        if (!state.pendingInvalidations.items.includes(nodeId)) {
          state.pendingInvalidations.items.push(nodeId);
        }

        // Check if sort order changes
        if (parentId) {
          const siblings = state.childrenByParentId[parentId] || [];
          const currentIndex = siblings.indexOf(nodeId);

          if (currentIndex !== -1 && siblings.length > 1) {
            // Build comparable nodes for sorting
            const resolve = (id: string) => {
              const n = state.nodes[id];
              return {
                nodeId: id,
                kind: (n?.kind || 'file') as 'folder' | 'file',
                name: n?.label || '',
                sortKey: n?.sortKey
              };
            };

            // Check if position would change by comparing with neighbors
            const myNode = resolve(nodeId);
            const prevSibling = currentIndex > 0 ? resolve(siblings[currentIndex - 1]) : null;
            const nextSibling = currentIndex < siblings.length - 1 ? resolve(siblings[currentIndex + 1]) : null;

            const needsResort =
              (prevSibling && compareBySortKey(myNode, prevSibling) < 0) ||
              (nextSibling && compareBySortKey(myNode, nextSibling) > 0);

            if (needsResort) {
              // Re-sort the children array
              const sorted = [...siblings].sort((a, b) => compareBySortKey(resolve(a), resolve(b)));
              state.childrenByParentId[parentId] = sorted;

              // Mark parent for children invalidation
              if (!state.pendingInvalidations.parents.includes(parentId)) {
                state.pendingInvalidations.parents.push(parentId);
              }
            }
          }
        }
      }
    )
    // AIDEV-NOTE: Clear only the invalidations that were actually processed (race-safe).
    .addCase(clearInvalidations,
      function (state: QueryTreeRecord, action: PayloadAction<{ items: string[]; parents: string[] }>) {
        const inv = state.pendingInvalidations;
        if (!inv) return;

        // Only remove what was processed
        inv.items = inv.items.filter(id => !action.payload.items.includes(id));
        inv.parents = inv.parents.filter(id => !action.payload.parents.includes(id));

        // Clean up if empty
        if (inv.items.length === 0 && inv.parents.length === 0) {
          state.pendingInvalidations = undefined;
        }
      }
    );
});
