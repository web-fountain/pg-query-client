import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState }     from '@Redux/store';
import type { UUIDv7 }        from '@Types/primitives';
import type {
  QueryTreeRecord,
  TreeNode
}                             from './types';

import {
  createAction, createReducer,
  createSelector
}                             from '@reduxjs/toolkit';

import { compareBySortKey, findInsertIndexIds } from './sort';


// Action Creators
export const setInitialQueryTree = createAction<QueryTreeRecord> ('queryTree/setInitialQueryTree');
export const setQueryTree = createAction<QueryTreeRecord> ('queryTree/setQueryTree');
export const setChildren  = createAction<{ parentId: string; rows: TreeNode[] }>   ('queryTree/setChildren');
export const upsertNode   = createAction<TreeNode>                                    ('queryTree/upsertNode');
export const addChild     = createAction<{ parentId: string; node: TreeNode }>        ('queryTree/addChild');
export const renameNode   = createAction<{ id: string; name: string }>                ('queryTree/renameNode');
export const moveNode     = createAction<{ nodeId: string; oldParentNodeId: string; newParentNodeId: string; index?: number }>('queryTree/moveNode');
export const resortChildren      = createAction<{ parentId: string }>('queryTree/resortChildren');
export const insertChildSorted   = createAction<{ parentId: string; node: TreeNode }>('queryTree/insertChildSorted');

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
    (state: RootState, id: string) => id,
    (state: RootState) => state.queryTree
  ],
  (id, tree) => tree.nodes[id]
);

export const selectQueryTree = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.queryTree],
  (queryTree): QueryTreeRecord => queryTree,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
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
      }
    )
    .addCase(setQueryTree,
      function (state: QueryTreeRecord, action: PayloadAction<QueryTreeRecord>) {
        Object.assign(state, action.payload);
      }
    )
    .addCase(setChildren,
      function (state: QueryTreeRecord, action: PayloadAction<{ parentId: string; rows: TreeNode[] }>) {
        const { parentId, rows } = action.payload;
        const ids: string[] = [];

        for (const r of rows) {
          state.nodes[r.nodeId] = { ...r, nodeId: r.nodeId, parentNodeId: parentId };
          ids.push(r.nodeId);
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
    .addCase(renameNode,
      function (state: QueryTreeRecord, action: PayloadAction<{ id: string; name: string }>) {
        const { id, name } = action.payload;
        const n = state.nodes[id];
        if (n) n.label = name;
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
        if (!arr.includes(node.nodeId)) arr.splice(idx, 0, node.nodeId);
        state.childrenByParentId[parentId] = arr;
      }
    );
});
