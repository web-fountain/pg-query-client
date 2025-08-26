import type { PayloadAction }                           from '@reduxjs/toolkit';
import type { RootState }                               from '@Redux/store';
import type { LayoutRecord }                            from '../types';

import { createAction, createReducer, createSelector }  from '@reduxjs/toolkit';


// Action Creators
const togglePrimarySidepanel            = createAction          ('layout/togglePrimarySidepanel');
const closePrimarySidepanel             = createAction          ('layout/closePrimarySidepanel');
const openPrimarySidepanel              = createAction          ('layout/openPrimarySidepanel');
const setPrimarySidepanelPosition       = createAction<'left' | 'right'>('layout/setPrimarySidepanelPosition');
const setPrimarySidepanelPreviousWidth  = createAction<number>  ('layout/setPrimarySidepanelPreviousWidth');
const setPrimarySidepanelDisplayWidth   = createAction<number>  ('layout/setPrimarySidepanelDisplayWidth');

// Selectors
const selectPrimarySidepanel = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.layout],
  (layout) => layout.primarySidepanel,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const reducer = createReducer({} as LayoutRecord, (builder) => {
  builder
    .addCase(setPrimarySidepanelPosition,
      function(state: LayoutRecord, action: PayloadAction<LayoutRecord['primarySidepanel']['position']>) {
        state.primarySidepanel.position   = action.payload;
        state.secondarySidepanel.position = action.payload === 'left' ? 'right' : 'left';
      }
    )
    .addCase(togglePrimarySidepanel,
      function(state: LayoutRecord) {
        state.primarySidepanel.isClosed = !state.primarySidepanel.isClosed;
      }
    )
    .addCase(closePrimarySidepanel,
      function(state: LayoutRecord) {
        state.primarySidepanel.isClosed = true;
      }
    )
    .addCase(openPrimarySidepanel,
      function(state: LayoutRecord) {
        state.primarySidepanel.isClosed = false;
      }
    )
    .addCase(setPrimarySidepanelPreviousWidth,
      function(state: LayoutRecord, action: PayloadAction<number>) {
        state.primarySidepanel.previousWidth = action.payload;
      }
    )
    .addCase(setPrimarySidepanelDisplayWidth,
      function(state: LayoutRecord, action: PayloadAction<number>) {
        state.primarySidepanel.displayWidth = action.payload;
        state.primarySidepanel.previousWidth = action.payload;
      }
    );
});


export {
  togglePrimarySidepanel,
  closePrimarySidepanel,
  openPrimarySidepanel,
  setPrimarySidepanelPosition,
  setPrimarySidepanelPreviousWidth,
  setPrimarySidepanelDisplayWidth,
  selectPrimarySidepanel
};
export default reducer;
