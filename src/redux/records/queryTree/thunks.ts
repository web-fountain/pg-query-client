import type { RootState }                     from '@Redux/store';
import type { GetNodeChildrenArgs, TreeNode } from '@Redux/records/queryTree/types';

import { createAsyncThunk }                   from '@reduxjs/toolkit';

import {
  insertChildSorted, upsertNode
}                                             from '@Redux/records/queryTree';
import {
  getQueryTreeNodeChildrenAction,
  createQueryFolderAction
}                                             from '@OpSpaceQueriesActions/queryTree';
import {
  errorEntryFromActionError, updateError
}                                             from '@Redux/records/errors';
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
