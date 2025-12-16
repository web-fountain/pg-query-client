import type { RootState }                     from '@Redux/store';
import type { GetNodeChildrenArgs, TreeNode } from '@Redux/records/queryTree/types';
import type { UUIDv7 }                        from '@Types/primitives';

import { createAsyncThunk }                   from '@reduxjs/toolkit';

import {
  insertChildSorted,
  linkDataQueryIdToNodeIds,
  moveNode,
  registerInvalidations,
  resortChildren,
  upsertNode
}                                             from '@Redux/records/queryTree';
import {
  getMoveViolationCodeBase,
  getMoveViolationLabel,
  isDuplicateNameInParent,
  normalizeLabelForUniqueness,
  QUERY_TREE_ROOT_ID,
  MoveViolationCode
}                                             from '@Redux/records/queryTree/constraints';
import { setDataQueryRecord }                 from '@Redux/records/dataQuery';
import { addTabFromFetch }                    from '@Redux/records/tabbar';
import {
  getQueryTreeNodeChildrenAction,
  createQueryFolderAction,
  moveQueryTreeNodeAction
}                                             from '@OpSpaceQueriesActions/queryTree';
import { createSavedDataQueryAction }         from '@OpSpaceQueriesActions/queries/index';
import {
  errorEntryFromActionError, updateError
}                                             from '@Redux/records/errors';
import { logClientJson }                      from '@Observability/client';
import * as log                               from '@Observability/client/thunks';


export const getQueryTreeNodeChildrenThunk = createAsyncThunk<TreeNode[], GetNodeChildrenArgs, { state: RootState }>(
  'queryTree/getQueryTreeNodeChildren',
  async ({ nodeId }) => {
    log.thunkStart({
      thunk : 'queryTree/getQueryTreeNodeChildren',
      input : { nodeId }
    });

    // AIDEV-NOTE: QueryTree is initially hydrated via bootstrap. This thunk is used
    // only when a parent node has no children loaded yet; it delegates to the
    // server action, which returns the node plus its children.
    let res;
    try {
      res = await getQueryTreeNodeChildrenAction(nodeId);
    } catch (error) {
      log.thunkException({
        thunk   : 'queryTree/getQueryTreeNodeChildren',
        message : 'getQueryTreeNodeChildrenAction threw',
        error   : error,
        input   : { nodeId }
      });
      return [];
    }

    log.thunkResult({
      thunk  : 'queryTree/getQueryTreeNodeChildren',
      result : res,
      input  : { nodeId }
    });
    if (!res.success || !res.data) {
      return [];
    }

    const { children } = res.data;
    return children as TreeNode[];
  }
);

type CreateQueryFolderArgs = {
  parentFolderId? : string;
  name            : string;
};

export const createQueryFolderThunk = createAsyncThunk<TreeNode | null, CreateQueryFolderArgs, { state: RootState }>(
  'queryTree/createQueryFolderThunk',
  async ({ parentFolderId, name }, { dispatch }) => {

    log.thunkStart({
      thunk : 'queryTree/createQueryFolderThunk',
      input : {
        parentFolderId,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    });

    let res;
    try {
      res = await createQueryFolderAction({ parentFolderId, name });
    } catch (error) {
      log.thunkException({
        thunk   : 'queryTree/createQueryFolderThunk',
        message : 'createQueryFolderAction threw',
        error   : error,
        input   : {
          parentFolderId,
          nameLen: typeof name === 'string' ? name.length : undefined
        }
      });
      dispatch(updateError({
        actionType  : 'queryTree/createQueryFolderThunk',
        message     : 'Failed to create folder.',
        meta        : { error }
      }));
      return null;
    }

    log.thunkResult({
      thunk  : 'queryTree/createQueryFolderThunk',
      result : res,
      input  : {
        parentFolderId,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    });

    if (!res.success) {
      dispatch(updateError(errorEntryFromActionError({
        actionType: 'queryTree/createQueryFolderThunk',
        error     : res.error
      })));
      return null;
    }

    // AIDEV-NOTE: res.data IS the TreeNode directly (CreateQueryFolderResult = TreeNode).
    const node = res.data;

    // AIDEV-NOTE: Guard against backend returning a response without a valid node.
    // This can happen if the API shape doesn't match CreateQueryFolderResult.
    if (!node || typeof node !== 'object' || !node.nodeId) {
      log.thunkException({
        thunk   : 'queryTree/createQueryFolderThunk',
        message : 'Server returned success but node is missing or invalid',
        error   : { unexpectedMissingNode: true, resData: res.data },
        input   : {
          parentFolderId,
          nameLen: typeof name === 'string' ? name.length : undefined
        }
      });
      dispatch(updateError({
        actionType  : 'queryTree/createQueryFolderThunk',
        message     : 'Folder created but server response was invalid.',
        meta        : { resData: res.data }
      }));
      return null;
    }

    // AIDEV-NOTE: Insert the new folder node into the QueryTree in sorted order.
    dispatch(upsertNode(node));
    const parentId = String((node as any)?.parentNodeId ?? 'queries');
    dispatch(insertChildSorted({ parentId, node }));

    return node;
  }
);

type CreateSavedQueryFileArgs = {
  dataQueryId     : UUIDv7;
  name            : string;
  parentFolderId? : string;
  tabGroup?       : number;
};

// AIDEV-NOTE: Dedicated flow for QueryTree "New File" creation. This creates a saved DataQuery
// via a single backend endpoint and returns the authoritative saved QueryTree node.
export const createSavedQueryFileThunk = createAsyncThunk<TreeNode | null, CreateSavedQueryFileArgs, { state: RootState }>(
  'queryTree/createSavedQueryFileThunk',
  async ({ dataQueryId, name, parentFolderId, tabGroup }, { dispatch }) => {

    log.thunkStart({
      thunk : 'queryTree/createSavedQueryFileThunk',
      input : {
        dataQueryId,
        parentFolderId,
        tabGroup,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    });

    let res;
    try {
      res = await createSavedDataQueryAction({
        dataQueryId,
        name,
        parentFolderId,
        tabGroup
      });
    } catch (error) {
      log.thunkException({
        thunk   : 'queryTree/createSavedQueryFileThunk',
        message : 'createSavedDataQueryAction threw',
        error   : error,
        input   : {
          dataQueryId,
          parentFolderId,
          tabGroup,
          nameLen: typeof name === 'string' ? name.length : undefined
        }
      });
      dispatch(updateError({
        actionType  : 'queryTree/createSavedQueryFileThunk',
        message     : 'Failed to create query.',
        meta        : { error }
      }));
      return null;
    }

    log.thunkResult({
      thunk  : 'queryTree/createSavedQueryFileThunk',
      result : res,
      input  : {
        dataQueryId,
        parentFolderId,
        tabGroup,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    });

    if (!res.success) {
      dispatch(updateError(errorEntryFromActionError({
        actionType: 'queryTree/createSavedQueryFileThunk',
        error     : res.error
      })));
      return null;
    }

    const { dataQueryId: resDataQueryId, name: resName, ext, tab, tree } = res.data;

    if (!resDataQueryId || !tree || typeof tree !== 'object' || !tree.nodeId) {
      log.thunkException({
        thunk   : 'queryTree/createSavedQueryFileThunk',
        message : 'Server returned success but payload is missing required fields',
        error   : { unexpectedMissingData: true, resData: res.data },
        input   : {
          dataQueryId,
          parentFolderId,
          tabGroup,
          nameLen: typeof name === 'string' ? name.length : undefined
        }
      });
      dispatch(updateError({
        actionType  : 'queryTree/createSavedQueryFileThunk',
        message     : 'Query created but server response was invalid.',
        meta        : { resData: res.data }
      }));
      return null;
    }

    // AIDEV-NOTE: Ensure the created query is available in Redux immediately so opening
    // the query later (via openTabThunk) has data to render.
    dispatch(setDataQueryRecord({
      dataQueryId : resDataQueryId as UUIDv7,
      name        : resName,
      ext         : ext,
      queryText   : '',
      description : '',
      tags        : [],
      color       : null
    }));

    // AIDEV-NOTE: Add the tab to the tabbar so the query is immediately openable.
    if (tab) {
      dispatch(addTabFromFetch({
        tab: {
          groupId  : tab.groupId,
          tabId    : tab.tabId as UUIDv7,
          mountId  : tab.mountId as UUIDv7,
          position : tab.position
        }
      }));
    }

    // AIDEV-NOTE: Build the TreeNode from the response tree object.
    const node: TreeNode = {
      nodeId       : tree.nodeId as UUIDv7,
      parentNodeId : tree.parentNodeId,
      kind         : tree.kind,
      label        : tree.label,
      sortKey      : tree.sortKey,
      mountId      : tree.mountId as UUIDv7,
      level        : tree.level
    };

    // AIDEV-NOTE: Insert the new saved file node into the QueryTree in sorted order.
    dispatch(upsertNode(node));
    const parentId = String(tree.parentNodeId ?? 'queries');
    dispatch(insertChildSorted({ parentId, node }));

    try {
      dispatch(linkDataQueryIdToNodeIds({ dataQueryId: resDataQueryId as UUIDv7, nodeId: tree.nodeId as UUIDv7 }));
    } catch {}

    return node;
  }
);

type MoveSavedQueryFileArgs = {
  nodeId          : string;
  newParentNodeId : string;
};

// AIDEV-NOTE: Move a saved QueryTree *file* node under a new parent folder. This is used by
// the DirectoryPanel QueryTree DnD flow (file → folder). Folder moves and explicit reordering
// will be handled by future, more general thunks.
export const moveSavedQueryFileThunk = createAsyncThunk<void, MoveSavedQueryFileArgs, { state: RootState }>(
  'queryTree/moveSavedQueryFileThunk',
  async ({ nodeId, newParentNodeId }, { getState, dispatch }) => {
    const state = getState().queryTree;
    const node  = state.nodes[nodeId];
    const dest  = state.nodes[newParentNodeId];

    // AIDEV-NOTE: Centralized constraint gate (cheap checks) to keep DnD and other callers consistent.
    const base = getMoveViolationCodeBase(state, nodeId, newParentNodeId);
    if (base !== MoveViolationCode.Ok) {
      logClientJson('warn', () => ({
        event         : 'queryTree',
        phase         : 'constraint-violation',
        action        : 'moveSavedQueryFileThunk',
        constraint    : 'move-base',
        code          : base,
        reason        : getMoveViolationLabel(base),
        nodeId        : String(nodeId),
        newParentNodeId: String(newParentNodeId)
      }));
      return;
    }

    // AIDEV-NOTE: Best-effort duplicate-name guard when destination children are loaded.
    // If children are not loaded (null), we allow and rely on backend enforcement + rollback.
    try {
      const normalized = normalizeLabelForUniqueness(String((node as any)?.label ?? ''));
      const dupe = isDuplicateNameInParent(state, newParentNodeId, normalized, nodeId);
      if (dupe === true) {
        logClientJson('warn', () => ({
          event         : 'queryTree',
          phase         : 'constraint-violation',
          action        : 'moveSavedQueryFileThunk',
          constraint    : 'duplicate-name',
          nodeId        : String(nodeId),
          newParentNodeId: String(newParentNodeId),
          labelLen      : String((node as any)?.label ?? '').length
        }));
        return;
      }
    } catch {}

    const isRootTarget = String(newParentNodeId) === QUERY_TREE_ROOT_ID;
    if (!node) return;
    if (!dest && !isRootTarget) return;

    const oldParentNodeId = String((node as any).parentNodeId);
    const oldLevel = (node as any).level as number | undefined;

    log.thunkStart({
      thunk : 'queryTree/moveSavedQueryFileThunk',
      input : {
        nodeId,
        oldParentNodeId,
        newParentNodeId
      }
    });

    // AIDEV-NOTE: Optimistic local move:
    // - moveNode updates childrenByParentId for old/new parents plus parentNodeId.
    // - resortChildren re-applies sortKey/name ordering under the destination parent.
    dispatch(moveNode({ nodeId, oldParentNodeId, newParentNodeId }));
    dispatch(resortChildren({ parentId: newParentNodeId }));

    // AIDEV-NOTE: Update the moved file's level to be one deeper than the destination folder.
    const destLevel = ((dest as any)?.level ?? 0) + 1;
    dispatch(upsertNode({
      ...node,
      parentNodeId : newParentNodeId,
      level        : destLevel
    } as TreeNode));

    // AIDEV-NOTE: Mark parent nodes for childrenId invalidation so headless-tree refreshes
    // their children arrays without forcing a full tree remount.
    dispatch(registerInvalidations({
      parents: [oldParentNodeId, newParentNodeId]
    }));

    // AIDEV-NOTE: Backend is authoritative; on failure we rollback the optimistic move so UI
    // remains consistent with invariants (duplicate names, permission, depth, etc).
    const rollback = (emitError: boolean, reason?: unknown) => {
      try {
        dispatch(moveNode({ nodeId, oldParentNodeId: newParentNodeId, newParentNodeId: oldParentNodeId }));
        dispatch(resortChildren({ parentId: oldParentNodeId }));
        dispatch(resortChildren({ parentId: newParentNodeId }));
        dispatch(upsertNode({
          ...(node as any),
          parentNodeId : oldParentNodeId,
          level        : oldLevel
        } as TreeNode));
        dispatch(registerInvalidations({ parents: [oldParentNodeId, newParentNodeId] }));
      } catch {}

      if (emitError && reason) {
        dispatch(updateError({
          actionType  : 'queryTree/moveSavedQueryFileThunk',
          message     : 'Failed to move query.',
          meta        : { reason }
        }));
      }
    };

    try {
      const res = await moveQueryTreeNodeAction({ nodeId, newParentNodeId });

      log.thunkResult({
        thunk  : 'queryTree/moveSavedQueryFileThunk',
        result : res,
        input  : {
          nodeId,
          oldParentNodeId,
          newParentNodeId
        }
      });

      if (!res.success) {
        dispatch(updateError(errorEntryFromActionError({
          actionType: 'queryTree/moveSavedQueryFileThunk',
          error     : res.error
        })));
        rollback(false);
      }
    } catch (error) {
      log.thunkException({
        thunk   : 'queryTree/moveSavedQueryFileThunk',
        message : 'moveQueryTreeNodeAction threw',
        error   : error,
        input   : {
          nodeId,
          oldParentNodeId,
          newParentNodeId
        }
      });

      rollback(true, error);
    }
  }
);
