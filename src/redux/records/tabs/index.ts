import type { PayloadAction }   from '@reduxjs/toolkit';
import type { RootState }       from '@Redux/store';
import type { QueryTab, UUID }  from '@Types/workspace';

import { createAction, createReducer, createSelector } from '@reduxjs/toolkit';


type Drafts = Record<UUID, { sqlDraft?: string; nameDraft?: string }>;

type TabsState = {
  tabs: QueryTab[];
  activeTabId: UUID | null;
  focusedTabIndex: number;
  drafts: Drafts;
  hydratedFromServer: boolean;
  mergedFromLocal: boolean;
};

const initialState: TabsState = {
  tabs: [],
  activeTabId: null,
  focusedTabIndex: 0,
  drafts: {},
  hydratedFromServer: false,
  mergedFromLocal: false
};

// Actions
const rehydrateFromServer = createAction<{ tabs: QueryTab[]; activeTabId: UUID }>                         ('tabs/rehydrateFromServer');
const mergeFromLocal      = createAction<{ tabs?: QueryTab[]; activeTabId?: UUID }>                       ('tabs/mergeFromLocal');
const addTab              = createAction<{ id: UUID; name: string; createdAt: number; updatedAt: number }>('tabs/addTab');
const closeTab            = createAction<{ id: UUID }>                                                    ('tabs/closeTab');
const activateTab         = createAction<{ id: UUID }>                                                    ('tabs/activateTab');
const focusTabIndex       = createAction<{ index: number }>                                               ('tabs/focusTabIndex');
const setNameDraft        = createAction<{ id: UUID; name: string }>                                      ('tabs/setNameDraft');
const setSqlDraft         = createAction<{ id: UUID; sql: string }>                                       ('tabs/setSqlDraft');
const commitSaveActive    = createAction                                                                  ('tabs/commitSaveActive');

// Selectors
export const selectTabs = createSelector.withTypes<RootState>()(
  [(state) => state.tabs.tabs],
  (tabs): QueryTab[] => tabs,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectActiveTabId = createSelector.withTypes<RootState>()(
  [state => state.tabs.activeTabId],
  (activeTabId) => activeTabId,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectFocusedTabIndex = createSelector.withTypes<RootState>()(
  [state => state.tabs.focusedTabIndex],
  (focusedTabIndex) => focusedTabIndex,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectDrafts = createSelector.withTypes<RootState>()(
  [state => state.tabs.drafts],
  (drafts) => drafts,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectHydratedFromServer = createSelector.withTypes<RootState>()(
  [state => state.tabs.hydratedFromServer],
  (hydrated) => hydrated,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
export const selectMergedFromLocal = createSelector.withTypes<RootState>()(
  [state => state.tabs.mergedFromLocal],
  (merged) => merged,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// Reducer
const reducer = createReducer(initialState, (builder) => {
  builder
    .addCase(rehydrateFromServer, function(state: TabsState, action: PayloadAction<{ tabs: QueryTab[]; activeTabId: UUID }>) {
      state.tabs = action.payload.tabs;
      state.activeTabId = action.payload.activeTabId;
      state.focusedTabIndex = Math.max(0, state.tabs.findIndex(t => t.id === state.activeTabId));
      state.hydratedFromServer = true;
    })
    .addCase(mergeFromLocal, function(state: TabsState, action: PayloadAction<{ tabs?: QueryTab[]; activeTabId?: UUID }>) {
      const { tabs, activeTabId } = action.payload;
      if (Array.isArray(tabs) && tabs.length > 0) {
        // Merge only names where ids match; keep server SQL authoritative unless explicitly saved
        const byId = new Map(state.tabs.map(t => [t.id, t] as const));
        const merged = state.tabs.map(t => {
          const lt = (tabs as QueryTab[]).find(st => st.id === t.id);
          return lt ? { ...t, name: lt.name || t.name } : t;
        });
        state.tabs = merged;
      }
      // AIDEV-NOTE: Do NOT override server-provided active tab. Prefer route intent.
      state.mergedFromLocal = true;
    })
    .addCase(addTab, function(state: TabsState, action: PayloadAction<{ id: UUID; name: string; createdAt: number; updatedAt: number }>) {
      const newTab: QueryTab = { id: action.payload.id, name: action.payload.name, sql: '', createdAt: action.payload.createdAt, updatedAt: action.payload.updatedAt };
      state.tabs.push(newTab);
      state.activeTabId = newTab.id;
      state.focusedTabIndex = state.tabs.length - 1;
    })
    .addCase(closeTab, function(state: TabsState, action: PayloadAction<{ id: UUID }>) {
      const idx = state.tabs.findIndex(t => t.id === action.payload.id);
      if (idx < 0) return;
      const closingActive = state.activeTabId === action.payload.id;
      state.tabs.splice(idx, 1);
      if (state.tabs.length === 0) {
        state.activeTabId = null;
        state.focusedTabIndex = 0;
        return;
      }
      if (closingActive) {
        const fallbackIndex = Math.max(0, idx - 1);
        state.activeTabId = state.tabs[Math.min(fallbackIndex, state.tabs.length - 1)].id;
        state.focusedTabIndex = Math.min(fallbackIndex, state.tabs.length - 1);
      } else if (state.focusedTabIndex >= state.tabs.length) {
        state.focusedTabIndex = state.tabs.length - 1;
      }
    })
    .addCase(activateTab, function(state: TabsState, action: PayloadAction<{ id: UUID }>) {
      const idx = state.tabs.findIndex(t => t.id === action.payload.id);
      if (idx < 0) return;
      state.activeTabId = action.payload.id;
      state.focusedTabIndex = idx;
    })
    .addCase(focusTabIndex, function(state: TabsState, action: PayloadAction<{ index: number }>) {
      const clamped = (action.payload.index + state.tabs.length) % state.tabs.length;
      state.focusedTabIndex = clamped;
    })
    .addCase(setNameDraft, function(state: TabsState, action: PayloadAction<{ id: UUID; name: string }>) {
      const d = state.drafts[action.payload.id] || {};
      d.nameDraft = action.payload.name;
      state.drafts[action.payload.id] = d;
    })
    .addCase(setSqlDraft, function(state: TabsState, action: PayloadAction<{ id: UUID; sql: string }>) {
      const d = state.drafts[action.payload.id] || {};
      d.sqlDraft = action.payload.sql;
      state.drafts[action.payload.id] = d;
    })
    .addCase(commitSaveActive, function(state: TabsState) {
      if (!state.activeTabId) return;
      const idx = state.tabs.findIndex(t => t.id === state.activeTabId);
      if (idx < 0) return;
      const draft = state.drafts[state.activeTabId] || {};
      const cur = state.tabs[idx];
      const name = draft.nameDraft ?? cur.name;
      const sql  = draft.sqlDraft  ?? cur.sql;
      state.tabs[idx] = { ...cur, name, sql, updatedAt: Date.now() };
    });
});


export type { TabsState };
export {
  rehydrateFromServer,
  mergeFromLocal,
  addTab,
  closeTab,
  activateTab,
  focusTabIndex,
  setNameDraft,
  setSqlDraft,
  commitSaveActive
};
export default reducer;
