import type { RootState }                     from '@Redux/store';
import type { GetNodeChildrenArgs, TreeNode } from '@Redux/records/queryTree/types';
import { createAsyncThunk }                   from '@reduxjs/toolkit';

import { getQueryTreeNodeChildrenAction }     from '@OpSpaceQueriesActions/queryTree';
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
