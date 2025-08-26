import type { PayloadAction }                           from '@reduxjs/toolkit';
import type { RootState }                               from '@Redux/store';
import type { SecondarySidepanel }                      from '@Types/Layout';
import type { LayoutRecord }                            from '../types';

import { createAction, createReducer, createSelector }  from '@reduxjs/toolkit';


// Action Creators
const toggleSecondarySidepanel            = createAction          ('layout/toggleSecondarySidepanel');
const closeSecondarySidepanel             = createAction          ('layout/closeSecondarySidepanel');
const openSecondarySidepanel              = createAction          ('layout/openSecondarySidepanel');
const setSecondarySidepanelPreviousWidth  = createAction<number>  ('layout/setSecondarySidepanelPreviousWidth');
const setSecondarySidepanelDisplayWidth   = createAction<number>  ('layout/setSecondarySidepanelDisplayWidth');

// Selectors
const selectSecondarySidepanel = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.layout],
  (layout) => layout.secondarySidepanel,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const reducer = createReducer({} as LayoutRecord, (builder) => {
  builder
    .addCase(toggleSecondarySidepanel,
      function(state: LayoutRecord) {
        state.secondarySidepanel.isClosed = !state.secondarySidepanel.isClosed;
      }
    )
    .addCase(closeSecondarySidepanel,
      function(state: LayoutRecord) {
        state.secondarySidepanel.isClosed = true;
      }
    )
    .addCase(openSecondarySidepanel,
      function(state: LayoutRecord) {
        state.secondarySidepanel.isClosed = false;
      }
    )
    .addCase(setSecondarySidepanelPreviousWidth,
      function(state: LayoutRecord, action: PayloadAction<number>) {
        state.secondarySidepanel.previousWidth = action.payload;
      }
    )
    .addCase(setSecondarySidepanelDisplayWidth,
      function(state: LayoutRecord, action: PayloadAction<number>) {
        state.secondarySidepanel.displayWidth = action.payload;
        state.secondarySidepanel.previousWidth = action.payload;
      }
    );
});


export {
  toggleSecondarySidepanel,
  closeSecondarySidepanel,
  openSecondarySidepanel,
  setSecondarySidepanelPreviousWidth,
  setSecondarySidepanelDisplayWidth,
  selectSecondarySidepanel
};
export default reducer;
