import type { RootState }     from '@Redux/store';
import type { TreeNode, QueryTreeRecord }     from '@Redux/records/queryTree/types';
import { createAsyncThunk }   from '@reduxjs/toolkit';


type GetNodeChildren = {
  nodeId: string;
};

export const getQueryTreeNodeChildrenThunk = createAsyncThunk<TreeNode[], GetNodeChildren, { state: RootState }>(
  'queryTree/getQueryTreeNodeChildren',
  async ({ nodeId }, { getState, dispatch }) => {
    console.log('[getQueryTreeNodeChildrenThunk] nodeId', nodeId);

    const { queryTree, url } = getState();
    console.log('[getQueryTreeNodeChildrenThunk] queryTree', queryTree);
    const opspaceId = url.opspaceId as string;
    const node = queryTree?.nodes?.[nodeId];

    const children: TreeNode[] = [];
    return children;
  }
);
