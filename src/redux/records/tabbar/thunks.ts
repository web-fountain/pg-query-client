import type { RootState }               from '@Redux/store';
import type { UnsavedQueryTreeNode }    from '@Redux/records/unsavedQueryTree/types';
import type { UUIDv7 }                  from '@Types/primitives';

import { createAsyncThunk }             from '@reduxjs/toolkit';
import * as log                         from '@Observability/client/thunks';
import {
  addTabFromFetch, closeTab,
  reorderTabs, setActiveTab
}                                       from '@Redux/records/tabbar';
import { removeUnsavedTreeNodeByTabId } from '@Redux/records/unsavedQueryTree';
import {
  selectDataQueryIdForTabId,
  setLastActiveUnsavedTabId
}                                       from '@Redux/records/tabbar/index';
import { removeDataQueryRecord }        from '@Redux/records/dataQuery';
import {
  closeTabAction, openTabAction,
  reorderTabAction, setActiveTabAction
}                                       from '@OpSpaceQueriesActions/tabs/index';
import {
  errorEntryFromActionError,
  updateError
}                                       from '@Redux/records/errors';


type SetActiveTabResult = {
  isUnsaved : boolean;
  mountId   : UUIDv7 | null;
};
export const setActiveTabThunk = createAsyncThunk<SetActiveTabResult, UUIDv7, { state: RootState }>(
  'tabs/setActiveTabThunk',
  async (tabId, { dispatch, getState }) => {
    const state = getState();
    const { tabs, unsavedQueryTree } = state;

    const node = unsavedQueryTree.nodes[tabId] as UnsavedQueryTreeNode | undefined;
    const isUnsaved = !!node;
    // AIDEV-NOTE: mountId is assumed to be dataQueryId today (see openTabAction). We return it so
    // UI code doesn't need to reconstruct it (and risk mixing up tabId vs mountId).
    const mountId = selectDataQueryIdForTabId(state, tabId) || node?.mountId || null;

    log.thunkStart({
      thunk : 'tabs/setActiveTabThunk',
      input : { tabId, isUnsaved, mountId }
    });

    if (tabs.activeTabId !== tabId) {
      dispatch(setActiveTab({ tabId }));
    }

    if (isUnsaved) {
      dispatch(setLastActiveUnsavedTabId({ tabId }));
    }

    try {
      const res = await setActiveTabAction(tabId);
      log.thunkResult({
        thunk  : 'tabs/setActiveTabThunk',
        result : res,
        input  : { tabId, isUnsaved, mountId }
      });
      if (!res.success) {
        dispatch(updateError(errorEntryFromActionError({
          actionType  : 'tabs/setActiveTabThunk',
          error       : res.error
        })));
      }
    } catch (error) {
      log.thunkException({
        thunk   : 'tabs/setActiveTabThunk',
        message : 'setActiveTabAction threw',
        error   : error,
        input   : { tabId, isUnsaved, mountId }
      });
      dispatch(updateError({
        actionType  : 'tabs/setActiveTabThunk',
        message     : 'Failed to set active tab.',
        meta        : { error }
      }));
    }

    return { isUnsaved, mountId };
  }
);

type CloseTabResult = {
  nextDataQueryId   : UUIDv7 | null;
  nextTabIsUnsaved  : boolean;
  hasRemainingTabs  : boolean;
};
export const closeTabThunk = createAsyncThunk<CloseTabResult, UUIDv7, { state: RootState }>(
  'tabs/closeTabThunk',
  async (tabId, { dispatch, getState }) => {
    const { unsavedQueryTree } = getState();

    // AIDEV-NOTE: Unsaved queries always have a corresponding node keyed by tabId.
    const node = unsavedQueryTree.nodes[tabId] as UnsavedQueryTreeNode | undefined;

    log.thunkStart({
      thunk : 'tabs/closeTabThunk',
      input : {
        tabId,
        isUnsaved: Boolean(node),
        mountId: node?.mountId
      }
    });

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

    const prevLast = postState.tabs.lastActiveUnsavedTabId;
    const currentUnsavedIds = new Set(Object.keys(postState.unsavedQueryTree.nodes || {}));
    let nextLastUnsaved: UUIDv7 | null = null;
    for (const tId of postState.tabs.tabIds) {
      if (currentUnsavedIds.has(String(tId))) {
        nextLastUnsaved = tId as UUIDv7;
        break;
      }
    }
    if (prevLast !== nextLastUnsaved) {
      dispatch(setLastActiveUnsavedTabId({ tabId: nextLastUnsaved }));
    }

    closeTabAction(tabId)
      .then((res) => {
        log.thunkResult({
          thunk  : 'tabs/closeTabThunk',
          result : res,
          input  : { tabId }
        });
        if (!res.success) {
          dispatch(updateError(errorEntryFromActionError({
            actionType  : 'tabs/closeTabThunk',
            error       : res.error
          })));
        }
      })
      .catch((error) => {
        log.thunkException({
          thunk   : 'tabs/closeTabThunk',
          message : 'closeTabAction threw',
          error   : error,
          input   : { tabId }
        });
        dispatch(updateError({
          actionType  : 'tabs/closeTabThunk',
          message     : 'Failed to close tab.',
          meta        : { error }
        }));
      });

    return {
      nextDataQueryId,
      nextTabIsUnsaved,
      hasRemainingTabs: postState.tabs.tabIds.length > 0
    };
  }
);

export const closeAllUnsavedTabsThunk = createAsyncThunk<void, void, { state: RootState }>(
  'tabs/closeAllUnsavedTabsThunk',
  async (_arg, { dispatch, getState }) => {
    const state = getState();
    const { unsavedQueryTree, tabs } = state;

    // AIDEV-NOTE: Collect all unsaved tabIds (file-kind nodes) in current tab order so that
    // close semantics remain predictable and consistent with single-tab closes.
    const unsavedIds = new Set<string>();
    for (const key of Object.keys(unsavedQueryTree.nodes || {})) {
      const node = unsavedQueryTree.nodes[key] as UnsavedQueryTreeNode | undefined;
      if (node && node.kind === 'file') {
        unsavedIds.add(String(node.nodeId));
      }
    }

    if (!unsavedIds.size) {
      return;
    }

    const orderedUnsavedTabIds: UUIDv7[] = [];
    for (const tabId of tabs.tabIds) {
      if (unsavedIds.has(String(tabId))) {
        orderedUnsavedTabIds.push(tabId as UUIDv7);
      }
    }

    log.thunkStart({
      thunk : 'tabs/closeAllUnsavedTabsThunk',
      input : {
        unsavedCount : orderedUnsavedTabIds.length
      }
    });

    for (const tabId of orderedUnsavedTabIds) {
      try {
        // AIDEV-NOTE: Delegate to closeTabThunk to ensure all side effects (Redux + server)
        // remain centralized in a single pathway.
        await dispatch(closeTabThunk(tabId)).unwrap();
      } catch (error) {
        log.thunkException({
          thunk   : 'tabs/closeAllUnsavedTabsThunk',
          message : 'closeTabThunk threw while closing all unsaved tabs',
          error   : error,
          input   : { tabId }
        });
        // AIDEV-NOTE: Continue closing remaining tabs even if one fails.
      }
    }
  }
);

export const openTabThunk = createAsyncThunk<UUIDv7 | null, UUIDv7, { state: RootState }>(
  'tabs/openTabThunk',
  async (mountId, { dispatch }) => {
    log.thunkStart({
      thunk : 'tabs/openTabThunk',
      input : { mountId }
    });

    try {
      const res = await openTabAction(mountId);
      log.thunkResult({
        thunk  : 'tabs/openTabThunk',
        result : res,
        input  : { mountId }
      });

      if (!res.success) {
        dispatch(updateError(errorEntryFromActionError({
          actionType  : 'tabs/openTabThunk',
          error       : res.error
        })));
        return null;
      }

      dispatch(addTabFromFetch({ tab: res.data }));

      return res.data.tabId;
    } catch (error) {
      log.thunkException({
        thunk   : 'tabs/openTabThunk',
        message : 'openTabAction threw',
        error   : error,
        input   : { mountId }
      });
      dispatch(updateError({
        actionType  : 'tabs/openTabThunk',
        message     : 'Failed to open tab.',
        meta        : { error }
      }));
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

    log.thunkStart({
      thunk : 'tabs/reorderTabsThunk',
      input : {
        tabId,
        newPosition,
        tabCount: tabIds.length
      }
    });

    try {
      const res = await reorderTabAction(tabId, newPosition);
      log.thunkResult({
        thunk  : 'tabs/reorderTabsThunk',
        result : res,
        input  : { tabId, newPosition, tabCount: tabIds.length }
      });

      if (!res.success) {
        dispatch(updateError(errorEntryFromActionError({
          actionType  : 'tabs/reorderTabsThunk',
          error       : res.error
        })));
        return;
      }
    } catch (error) {
      log.thunkException({
        thunk   : 'tabs/reorderTabsThunk',
        message : 'reorderTabAction threw',
        error   : error,
        input   : { tabId, newPosition, tabCount: tabIds.length }
      });
      dispatch(updateError({
        actionType  : 'tabs/reorderTabsThunk',
        message     : 'Failed to reorder tabs.',
        meta        : { error }
      }));
      return;
    }
  }
);
