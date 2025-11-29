import type { RootState } from '@Redux/store';
import type { UUIDv7 }    from '@Types/primitives';

import { createAsyncThunk }                   from '@reduxjs/toolkit';
import { closeTab, setActiveTab }             from '@Redux/records/tabbar';
import { removeUnsavedTreeNodeByTabId }       from '@Redux/records/unsavedQueryTree';
import { selectDataQueryIdForTabId }          from '@Redux/records/tabbar/index';
import { setActiveTabAction, closeTabAction } from '@/app/opspace/[opspaceId]/queries/[dataQueryId]/_actions/tabs/index';


export const setActiveTabThunk = createAsyncThunk<void, UUIDv7, { state: RootState }>(
  'tabs/setActiveTabThunk',
  async (tabId, { dispatch }) => {
    dispatch(setActiveTab({ tabId }));

    try {
      const res = await setActiveTabAction(tabId);

      if (!res.success) {
        console.error(`Failed to set active tab: ${tabId}`);
        return;
      }
    } catch (error) {
      console.error(`Error setting active tab: ${tabId}`, error);
      return;
    }
  }
);

export const closeTabThunk = createAsyncThunk<UUIDv7 | null, UUIDv7, { state: RootState }>(
  'tabs/closeTabThunk',
  async (tabId, { dispatch, getState }) => {
    const { unsavedQueryTree } = getState();
    const hasUnsavedTreeNode = Boolean(unsavedQueryTree.nodes[tabId]);

    dispatch(closeTab({ tabId }));

    if (hasUnsavedTreeNode) {
      dispatch(removeUnsavedTreeNodeByTabId({ tabId }));
    }

    const postState  = getState();
    const nextTabId = postState.tabs.activeTabId;
    const nextDataQueryId = selectDataQueryIdForTabId(postState, nextTabId);

    // Fire-and-forget server sync
    closeTabAction(tabId).catch((error) => {
      console.error(`Error closing tab: ${tabId}`, error);
      // optionally dispatch an error action / toast
    });

    return nextDataQueryId;
  }
);
