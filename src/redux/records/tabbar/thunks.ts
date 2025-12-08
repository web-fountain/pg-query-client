import type { RootState }               from '@Redux/store';
import type { UnsavedQueryTreeNode }    from '@Redux/records/unsavedQueryTree/types';
import type { UUIDv7 }                  from '@Types/primitives';

import { createAsyncThunk }             from '@reduxjs/toolkit';
import {
  addTabFromFetch,
  closeTab,
  reorderTabs,
  setActiveTab
}                                       from '@Redux/records/tabbar';
import { removeUnsavedTreeNodeByTabId } from '@Redux/records/unsavedQueryTree';
import {
  selectDataQueryIdForTabId,
  setLastActiveUnsavedTabId
}                                       from '@Redux/records/tabbar/index';
import { removeDataQueryRecord }        from '@Redux/records/dataQuery';
import {
  closeTabAction,
  openTabAction,
  reorderTabAction,
  setActiveTabAction
}                                       from '@/app/opspace/[opspaceId]/queries/_actions/tabs/index';


export const setActiveTabThunk = createAsyncThunk<boolean, UUIDv7, { state: RootState }>(
  'tabs/setActiveTabThunk',
  async (tabId, { dispatch, getState }) => {
    const { tabs, unsavedQueryTree } = getState();

    const isUnsaved =
      !!(unsavedQueryTree.nodes[tabId] as UnsavedQueryTreeNode | undefined);

    if (tabs.activeTabId !== tabId) {
      dispatch(setActiveTab({ tabId }));
    }

    if (isUnsaved) {
      dispatch(setLastActiveUnsavedTabId({ tabId }));
    }

    try {
      const res = await setActiveTabAction(tabId);
      if (!res.success) {
        console.error(`Failed to set active tab: ${tabId}`);
      }
    } catch (error) {
      console.error(`Error setting active tab: ${tabId}`, error);
    }

    return isUnsaved; // lets callers know if this is an unsaved tab
  }
);

type CloseTabResult = {
  nextDataQueryId: UUIDv7 | null;
  nextTabIsUnsaved: boolean;
  hasRemainingTabs: boolean;
};
export const closeTabThunk = createAsyncThunk<CloseTabResult, UUIDv7, { state: RootState }>(
  'tabs/closeTabThunk',
  async (tabId, { dispatch, getState }) => {
    const { unsavedQueryTree } = getState();

    // AIDEV-NOTE: Unsaved queries always have a corresponding node keyed by tabId.
    const node = unsavedQueryTree.nodes[tabId] as UnsavedQueryTreeNode | undefined;

    dispatch(closeTab({ tabId }));

    if (node) {
      dispatch(removeUnsavedTreeNodeByTabId({ tabId }));
      dispatch(removeDataQueryRecord({ dataQueryId: node.mountId }));
    }

    const postState       = getState();
    const nextTabId       = postState.tabs.activeTabId;
    const nextDataQueryId = selectDataQueryIdForTabId(postState, nextTabId);

    const nextTabIsUnsaved = !!(
      nextTabId && (postState.unsavedQueryTree.nodes[nextTabId] as UnsavedQueryTreeNode | undefined)
    );

    closeTabAction(tabId).catch((error) => {
      console.error(`Error closing tab: ${tabId}`, error);
    });

    return {
      nextDataQueryId,
      nextTabIsUnsaved,
      hasRemainingTabs: postState.tabs.tabIds.length > 0,
    };
  }
);

export const openTabThunk = createAsyncThunk<UUIDv7 | null, UUIDv7, { state: RootState }>(
  'tabs/openTabThunk',
  async (mountId, { dispatch }) => {
    try {
      const res = await openTabAction(mountId);

      if (!res.success || !res.data) {
        console.error(`Failed to open tab: ${mountId}`);
        return null;
      }

      dispatch(addTabFromFetch({ tab: res.data }));

      return res.data.tabId;
    } catch (error) {
      console.error(`Error opening tab: ${mountId}`, error);
      return null;
    }
  }
);

export const reorderTabsThunk = createAsyncThunk<void, UUIDv7[], { state: RootState }>(
  'tabs/reorderTabsThunk',
  async (tabIds, { dispatch, getState }) => {
    dispatch(reorderTabs({ tabIds }));

    const { tabs } = getState();
    const tabId = tabs.activeTabId as UUIDv7;
    const newPosition = tabs.focusedTabIndex as number;

    try {
      const res = await reorderTabAction(tabId, newPosition);

      if (!res.success) {
        console.error(`Failed to reorder tab: ${tabId}`);
        return;
      }
    } catch (error) {
      console.error(`Error reordering tabs: ${tabIds}`, error);
      return;
    }
  }
);
