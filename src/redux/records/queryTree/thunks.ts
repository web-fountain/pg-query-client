import type { RootState }     from '@Redux/store';
import type { TreeNode, QueryTreeRecord }     from '@Redux/records/queryTree/types';
import { createAsyncThunk }   from '@reduxjs/toolkit';


type GetNodeChildren = {
  nodeId: string;
};

export const getQueryTreeNodeChildrenThunk = createAsyncThunk<TreeNode[], GetNodeChildren, { state: RootState }>(
  'queryTree/getQueryTreeNodeChildren',
  async ({ nodeId }, { getState }) => {
    console.log('[getQueryTreeNodeChildrenThunk] nodeId', nodeId);

    const { queryTree } = getState();
    console.log('[getQueryTreeNodeChildrenThunk] queryTree', queryTree);
    const node = queryTree?.nodes?.[nodeId as any];

    const children: TreeNode[] = [];
    return children;
  }
);
