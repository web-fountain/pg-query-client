import type { PayloadAction }     from '@reduxjs/toolkit';
import type { RootState }         from '@Redux/store';
import type { UUIDv7 }            from '@Types/primitives';
import type { Tab, TabbarRecord } from './types';

import {
  createAction,
  createReducer,
  createSelector
}                                 from '@reduxjs/toolkit';


// Actions
export const setInitialTabs            = createAction<TabbarRecord>             ('tabs/setInitialTabs');
export const addTabFromFetch           = createAction<{ tab: Tab }>             ('tabs/addTabFromFetch');
export const closeTab                  = createAction<{ tabId: UUIDv7 }>        ('tabs/closeTab');
export const closeAllTabs              = createAction                           ('tabs/closeAllTabs');
export const setActiveTab              = createAction<{ tabId: UUIDv7 }>        ('tabs/setActiveTab');
export const focusTabIndex             = createAction<{ index: number }>        ('tabs/focusTabIndex');
export const reorderTabs               = createAction<{ tabIds: UUIDv7[] }>     ('tabs/reorderTabs');
export const setLastActiveUnsavedTabId = createAction<{ tabId: UUIDv7 | null }> ('tabs/setLastActiveUnsavedTabId');


// Selectors
export const selectTabIds                 = createSelector.withTypes<RootState>()(
  [(state) => state.tabs.tabIds],
  (tabIds) => tabIds,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectTabEntities            = createSelector.withTypes<RootState>()(
  [(state) => state.tabs.entities],
  (entities) => entities,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectActiveTabId            = createSelector.withTypes<RootState>()(
  [state => state.tabs.activeTabId],
  (activeTabId) => activeTabId,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectFocusedTabIndex        = createSelector.withTypes<RootState>()(
  [state => state.tabs.focusedTabIndex],
  (focusedTabIndex) => focusedTabIndex,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectDataQueryIdForTabId    = createSelector.withTypes<RootState>()(
  [
    (state: RootState) => state.tabs.entities,
    (_state: RootState, tabId: UUIDv7 | null) => tabId
  ],
  (entities, tabId) => {
    if (!tabId) return null;
    const tab = entities[tabId];
    return tab ? tab.mountId : null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectTabIdByMountIdMap      = createSelector.withTypes<RootState>()(
  [(state) => state.tabs.entities],
  (entities) => {
    const map = new Map<UUIDv7, UUIDv7>();
    for (const tab of Object.values(entities)) {
      map.set(tab.mountId, tab.tabId);
    }
    return map;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectLastActiveUnsavedTabId = createSelector.withTypes<RootState>()(
  [state => state.tabs.lastActiveUnsavedTabId],
  last => last,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);


// Reducer
const initialState: TabbarRecord = {
  tabIds                  : [],
  activeTabId             : null,
  focusedTabIndex         : null,
  entities                : {},
  lastActiveUnsavedTabId  : null
};
const reducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setInitialTabs,
      function(state: TabbarRecord, action: PayloadAction<TabbarRecord>) {
        Object.assign(state, action.payload);
      }
    )
    .addCase(addTabFromFetch,
      function(state: TabbarRecord, action: PayloadAction<{ tab: Tab }>) {
        const { tab } = action.payload;
        const { tabId, position } = tab;

        state.tabIds.push(tabId);
        state.activeTabId     = tabId;
        state.focusedTabIndex = position;
        state.entities[tabId] = tab;
      }
    )
    .addCase(closeTab,
      function(state: TabbarRecord, action: PayloadAction<{ tabId: UUIDv7 }>) {
        const { tabId } = action.payload;
        const tabIndex = state.tabIds.indexOf(tabId);

        const closingActive = state.activeTabId === tabId;

        state.tabIds.splice(tabIndex, 1);
        delete state.entities[tabId];

        if (state.tabIds.length === 0) {
          state.activeTabId = null;
          state.focusedTabIndex = null;
          return;
        }

        if (closingActive) {
          // AIDEV-NOTE: When closing the active tab, focus the next tab to the right.
          // If the closed tab was the last, focus the previous one instead.
          const nextIndex       = Math.min(tabIndex, state.tabIds.length - 1);
          state.activeTabId     = state.tabIds[nextIndex];
          state.focusedTabIndex = nextIndex;
        } else if (state.focusedTabIndex !== null) {
          // AIDEV-NOTE: Keep focus stable; shift left if a tab before the focus index was removed.
          if (state.focusedTabIndex > tabIndex) {
            state.focusedTabIndex = state.focusedTabIndex - 1;
          } else if (state.focusedTabIndex >= state.tabIds.length) {
            state.focusedTabIndex = state.tabIds.length - 1;
          }
        }
      }
    )
    .addCase(closeAllTabs,
      function(state: TabbarRecord) {
        // AIDEV-NOTE: Close all unsaved tabs at once; reset to empty state.
        state.tabIds = [];
        state.entities = {};
        state.activeTabId = null;
        state.focusedTabIndex = null;
        state.lastActiveUnsavedTabId = null;
      }
    )
    .addCase(setActiveTab,
      function(state: TabbarRecord, action: PayloadAction<{ tabId: UUIDv7 }>) {
        const { tabId } = action.payload;
        const tab       = state.entities[tabId];

        state.activeTabId = tabId;
        if (tab && typeof tab.position === 'number') {
          state.focusedTabIndex = tab.position;
          return;
        }

        // AIDEV-NOTE: Fallback for transient/incomplete state where tabIds contains the id
        // but entities is missing the corresponding tab. Prefer stable behavior over throwing.
        const idx = state.tabIds.indexOf(tabId);
        if (idx >= 0) {
          state.focusedTabIndex = idx;
        }
      }
    )
    .addCase(focusTabIndex,
      function(state: TabbarRecord, action: PayloadAction<{ index: number }>) {
        if (state.tabIds.length === 0) return;
        const clamped = (action.payload.index + state.tabIds.length) % state.tabIds.length;
        state.focusedTabIndex = clamped;
      }
    )
    .addCase(reorderTabs,
      function(state: TabbarRecord, action: PayloadAction<{ tabIds: UUIDv7[] }>) {
        const { tabIds } = action.payload;
        if (!tabIds || tabIds.length !== state.tabIds.length) {
          // AIDEV-NOTE: Ignore malformed reorder payloads; require same cardinality.
          return;
        }

        // Optional sanity check: ensure same set of ids
        const prevSet = new Set(state.tabIds);
        const nextSet = new Set(tabIds);
        if (prevSet.size !== nextSet.size) {
          return;
        }
        for (const id of prevSet) {
          if (!nextSet.has(id)) return;
        }

        state.tabIds = tabIds.slice();

        // AIDEV-NOTE: Keep Tab.position aligned with tabIds index to support server sync.
        state.tabIds.forEach((tabId, index) => {
          const tab = state.entities[tabId];
          if (tab) {
            tab.position = index;
          }
        });

        if (state.activeTabId) {
          const activeIndex = state.tabIds.indexOf(state.activeTabId);
          if (activeIndex !== -1) {
            state.focusedTabIndex = activeIndex;
          }
        }
      }
    )
    .addCase(setLastActiveUnsavedTabId,
      function(state: TabbarRecord, action: PayloadAction<{ tabId: UUIDv7 | null }>) {
        state.lastActiveUnsavedTabId = action.payload.tabId;
      }
    );
});


export default reducer;
