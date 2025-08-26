import type { PayloadAction }           from '@reduxjs/toolkit';
import type { RootState }               from '@Redux/store';

import { createAction, createReducer, createSelector } from '@reduxjs/toolkit';


type ResultsTab = 'data-output' | 'messages';
type Side = 'left' | 'right';
type PanelSideState = { width: number; collapsed: boolean; initialWidth: number };
type LayoutState = {
  splitRatio: number; // 0..1 (editor/results)
  resultsActiveTab: ResultsTab;
  left: PanelSideState;
  right: PanelSideState;
  contentSwapped: boolean;
};

const initialState: LayoutState = {
  splitRatio: 0.5,
  resultsActiveTab: 'data-output',
  left:  { width: 300, collapsed: false, initialWidth: 300 },
  right: { width: 300, collapsed: false, initialWidth: 300 },
  contentSwapped: false
};

// Actions
const setSplitRatio        = createAction<number>                     ('layout/setSplitRatio');
const setResultsActiveTab  = createAction<ResultsTab>                 ('layout/setResultsActiveTab');
const rehydrateLayout      = createAction<Partial<Pick<
                              LayoutState, 'left' | 'right' | 'contentSwapped' | 'splitRatio'>>
                              >                                       ('layout/rehydrateLayout');
const setSideWidth         = createAction<{ side: Side; px: number }> ('layout/setSideWidth');
const collapseSide         = createAction<Side>                       ('layout/collapseSide');
const expandSide           = createAction<Side>                       ('layout/expandSide');
const toggleCollapseSide   = createAction<Side>                       ('layout/toggleCollapseSide');
const resetSide            = createAction<Side>                       ('layout/resetSide');
const resetBothSides       = createAction                             ('layout/resetBothSides');
const swapSides            = createAction                             ('layout/swapSides');

// Selectors
const selectSplitRatio = createSelector.withTypes<RootState>()(
  [state => state.layout.splitRatio],
  (splitRatio) => splitRatio,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

const selectResultsActiveTab = createSelector.withTypes<RootState>()(
  [state => state.layout.resultsActiveTab],
  (resultsActiveTab) => resultsActiveTab,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

const selectPanelLeft = createSelector.withTypes<RootState>()(
  [state => state.layout.left],
  (left) => left,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
const selectPanelRight = createSelector.withTypes<RootState>()(
  [state => state.layout.right],
  (right) => right,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);
const selectContentSwapped = createSelector.withTypes<RootState>()(
  [state => state.layout.contentSwapped],
  (contentSwapped) => contentSwapped,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// Reducer
const reducer = createReducer(initialState, (builder) => {
  builder
    .addCase(rehydrateLayout, function(state: LayoutState, action: PayloadAction<Partial<Pick<LayoutState, 'left' | 'right' | 'contentSwapped' | 'splitRatio'>>>) {
      const { left, right, contentSwapped, splitRatio } = action.payload;
      if (left)  state.left  = { ...state.left,  ...left } as PanelSideState;
      if (right) state.right = { ...state.right, ...right } as PanelSideState;
      if (typeof contentSwapped === 'boolean') state.contentSwapped = contentSwapped;
      if (typeof splitRatio === 'number') state.splitRatio = Math.max(0, Math.min(1, Number(splitRatio)));
    })
    .addCase(setSplitRatio, function(state: LayoutState, action: PayloadAction<number>) {
      const n = Math.max(0, Math.min(1, Number(action.payload)));
      state.splitRatio = n;
    })
    .addCase(setResultsActiveTab, function(state: LayoutState, action: PayloadAction<ResultsTab>) {
      state.resultsActiveTab = action.payload;
    })
    .addCase(setSideWidth, function(state: LayoutState, action: PayloadAction<{ side: Side; px: number }>) {
      const { side, px } = action.payload;
      const clamped = Math.max(170, Math.min(600, Math.round(px)));
      state[side].width = clamped;
      state[side].collapsed = false;
    })
    .addCase(collapseSide, function(state: LayoutState, action: PayloadAction<Side>) {
      state[action.payload].collapsed = true;
    })
    .addCase(expandSide, function(state: LayoutState, action: PayloadAction<Side>) {
      state[action.payload].collapsed = false;
    })
    .addCase(toggleCollapseSide, function(state: LayoutState, action: PayloadAction<Side>) {
      state[action.payload].collapsed = !state[action.payload].collapsed;
    })
    .addCase(resetSide, function(state: LayoutState, action: PayloadAction<Side>) {
      const s = action.payload;
      state[s].width = state[s].initialWidth;
    })
    .addCase(resetBothSides, function(state: LayoutState) {
      state.left.width = state.left.initialWidth;
      state.right.width = state.right.initialWidth;
    })
    .addCase(swapSides, function(state: LayoutState) {
      const left = state.left; const right = state.right;
      state.left = { ...right };
      state.right = { ...left };
      state.contentSwapped = !state.contentSwapped;
    });
});


export type { LayoutState, ResultsTab, Side, PanelSideState };
export {
  setSplitRatio,
  setResultsActiveTab,
  rehydrateLayout,
  setSideWidth,
  collapseSide,
  expandSide,
  toggleCollapseSide,
  resetSide,
  resetBothSides,
  swapSides,
  selectSplitRatio,
  selectResultsActiveTab,
  selectPanelLeft,
  selectPanelRight,
  selectContentSwapped
};
export default reducer;
