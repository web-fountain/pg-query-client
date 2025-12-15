import type { RootState }               from '@Redux/store';
import type { UUIDv7 }                  from '@Types/primitives';
import type { TreeNode }                from '@Redux/records/queryTree/types';

import { createAsyncThunk }             from '@reduxjs/toolkit';
import * as log                         from '@Observability/client/thunks';
import {
  createNewUnsavedDataQuery,
  createNewUnsavedDataQueryFromFetch,
  markDataQuerySaved
}                                       from '@Redux/records/dataQuery';
import {
  addTabFromFetch,
  selectTabIdByMountIdMap,
  setLastActiveUnsavedTabId
}                                       from '@Redux/records/tabbar';
import {
  addUnsavedTreeNodeFromFetch,
  removeUnsavedTreeNodeByTabId
}                                       from '@Redux/records/unsavedQueryTree';
import {
  insertChildSorted,
  linkDataQueryIdToNodeIds,
  renameNodeWithInvalidation,
  upsertNode
}                                       from '@Redux/records/queryTree';
import { fsSortKeyEn }                  from '@Utils/collation';
import {
  createNewUnsavedDataQueryAction,
  updateDataQueryAction
}                                       from '@OpSpaceQueriesActions/queries/index';
import {
  errorEntryFromActionError,
  updateError
}                                       from '@Redux/records/errors';
import { requestSqlEditorAutofocus }    from '@Redux/records/uiFocus';


export const createNewUnsavedDataQueryThunk = createAsyncThunk<void, { dataQueryId: UUIDv7; name: string }, { state: RootState }>(
  'dataQuery/createNewUnsavedDataQueryThunk',
  async ({ dataQueryId, name }, { dispatch }) => {
    log.thunkStart({
      thunk : 'dataQuery/createNewUnsavedDataQueryThunk',
      input : {
        dataQueryId,
        nameLen: typeof name === 'string' ? name.length : undefined
      }
    });

    // AIDEV-NOTE: Creating a new unsaved query is an explicit "start typing" intent.
    // We request an editor autofocus; QueryWorkspace will honor it only when appropriate.
    dispatch(requestSqlEditorAutofocus());
    dispatch(createNewUnsavedDataQuery({ dataQueryId, name, ext: 'sql' }));

    const payload = { dataQueryId };
    try {
      const res = await createNewUnsavedDataQueryAction(payload);
      log.thunkResult({
        thunk  : 'dataQuery/createNewUnsavedDataQueryThunk',
        result : res,
        input  : { dataQueryId }
      });

      if (res.success) {
        const { dataQueryId, name, ext, tab, tree } = res.data;
        dispatch(createNewUnsavedDataQueryFromFetch({ dataQueryId, name, ext }));
        dispatch(addTabFromFetch({ tab }));
        dispatch(addUnsavedTreeNodeFromFetch({ tree }));
        dispatch(setLastActiveUnsavedTabId({ tabId: tab.tabId }));
      } else {
        dispatch(updateError(errorEntryFromActionError({
          actionType  : 'dataQuery/createNewUnsavedDataQueryThunk',
          error       : res.error
        })));
        return;
      }
    } catch (error) {
      log.thunkException({
        thunk   : 'dataQuery/createNewUnsavedDataQueryThunk',
        message : 'createNewUnsavedDataQueryAction threw',
        error   : error,
        input   : { dataQueryId }
      });
      dispatch(updateError({
        actionType  : 'dataQuery/createNewUnsavedDataQueryThunk',
        message     : 'Failed to create a new query.',
        meta        : { error }
      }));
      return;
    }
  }
);

type SaveDataQueryResult = {
  success       : boolean;
  isPromotion?  : boolean;
};
export const saveDataQueryThunk = createAsyncThunk<SaveDataQueryResult, { dataQueryId: UUIDv7 }, { state: RootState }>(
  'dataQuery/saveDataQueryThunk',
  async ({ dataQueryId }, { getState, dispatch }) => {
    // AIDEV-NOTE: This thunk assumes all pending edits (name, queryText) have already been
    // dispatched to Redux via updateDataQueryName/updateDataQueryText before being called.
    const state = getState();
    const { dataQueryRecords, queryTree } = state;
    const record = dataQueryRecords[dataQueryId];
    if (!record || !record.unsaved?.update) {
      return { success: false };
    }

    // AIDEV-NOTE: At this point, latest name/queryText edits should already be captured
    // in record.unsaved.update via write-time reducers (e.g., updateDataQueryName/Text).
    const payload       = record.unsaved.update;

    const nameLen       = typeof payload.name === 'string' ? payload.name.length : undefined;
    const queryTextLen  = typeof payload.queryText === 'string' ? payload.queryText.length : undefined;

    const tabIdByMountId = selectTabIdByMountIdMap(state);
    const tabId = tabIdByMountId.get(dataQueryId)!;

    // AIDEV-NOTE: A saved node exists for already-saved queries; we detect them via
    // existing QueryTree mappings. Promotion is determined after the backend call using
    // the presence of a server-assigned nodeId for the saved tree node.
    const hasSavedNode = !!queryTree.nodeIdsByDataQueryId?.[dataQueryId]?.length;
    const prevName = hasSavedNode ? record.current.name : undefined;

    log.thunkStart({
      thunk : 'dataQuery/saveDataQueryThunk',
      input : {
        dataQueryId,
        hasSavedNode,
        nameLen,
        queryTextLen
      }
    });

    // AIDEV-NOTE: Optimistic update for already-saved queries – update QueryTree labels immediately
    // so the directory reflects the new name while the backend call is in flight.
    if (hasSavedNode && payload.name) {
      dispatch(renameNodeWithInvalidation({ dataQueryId, name: payload.name }));
    }

    let treeNodeId: UUIDv7 | undefined;

    try {
      const res = await updateDataQueryAction(payload);
      log.thunkResult({
        thunk  : 'dataQuery/saveDataQueryThunk',
        result : res,
        input  : {
          dataQueryId,
          hasSavedNode,
          nameLen,
          queryTextLen
        }
      });
      if (!res.success) {
        dispatch(updateError(errorEntryFromActionError({
          actionType  : 'dataQuery/saveDataQueryThunk',
          error       : res.error
        })));
        // Rollback optimistic rename
        if (hasSavedNode && payload.name && prevName) {
          dispatch(renameNodeWithInvalidation({ dataQueryId, name: prevName }));
        }
        // AIDEV-TODO: Consider rollback of optimistic update on failure
        return { success: false };
      }

      if (res.data && res.data.nodeId) {
        treeNodeId = res.data.nodeId as UUIDv7;
      }
    } catch (error) {
      log.thunkException({
        thunk   : 'dataQuery/saveDataQueryThunk',
        message : 'updateDataQueryAction threw',
        error   : error,
        input   : {
          dataQueryId,
          hasSavedNode,
          nameLen,
          queryTextLen
        }
      });
      dispatch(updateError({
        actionType  : 'dataQuery/saveDataQueryThunk',
        message     : 'Failed to save query.',
        meta        : { error }
      }));
      // AIDEV-TODO: Consider rollback of optimistic update on failure
      return { success: false };
    }

    // AIDEV-NOTE: Backend save succeeded – mark the dataQueryRecord as clean and then
    // branch promotion vs regular-save behavior for tree/tab maintenance.
    dispatch(markDataQuerySaved(payload));

    if (treeNodeId) {
      // AIDEV-NOTE: Promotion path – move node from UnsavedQueryTree into the saved QueryTree.
      dispatch(removeUnsavedTreeNodeByTabId({ tabId }));

      const postState = getState();
      const { tabs, unsavedQueryTree: postUnsaved, dataQueryRecords: postRecords } = postState;

      const currentUnsavedIds = new Set<string>(Object.keys(postUnsaved.nodes || {}));
      let nextLastUnsaved: UUIDv7 | null = null;

      if (currentUnsavedIds.size > 0) {
        for (const tId of tabs.tabIds) {
          if (currentUnsavedIds.has(String(tId))) {
            nextLastUnsaved = tId as UUIDv7;
            break;
          }
        }
      }

      dispatch(setLastActiveUnsavedTabId({ tabId: nextLastUnsaved }));

      // AIDEV-NOTE: Insert a new saved node at the QUERIES root. This mirrors backend placement
      // semantics by defaulting to the root folder and using the same fsSortKeyEn helper.
      const rootId = 'queries';
      const latestRecord = postRecords[dataQueryId];
      const name = payload.name || latestRecord.persisted.name!;
      const kindIndicator = '1';
      const sortableLabel = fsSortKeyEn(name);
      const compositeSortKey = `${kindIndicator}|${sortableLabel}|${treeNodeId}`;


      const node: TreeNode = {
        nodeId       : treeNodeId,
        parentNodeId : rootId,
        kind         : 'file',
        label        : name,
        sortKey      : compositeSortKey,
        mountId      : dataQueryId,
        level        : 1
      };

      dispatch(upsertNode(node));
      dispatch(insertChildSorted({ parentId: rootId, node }));
      dispatch(linkDataQueryIdToNodeIds({ dataQueryId, nodeId: treeNodeId }));
    }

    return {
      success     : true,
      isPromotion : !!treeNodeId
    };
  }
);
