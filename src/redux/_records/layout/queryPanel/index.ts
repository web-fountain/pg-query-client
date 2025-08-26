import type { PayloadAction }                           from '@reduxjs/toolkit';
import type { RootState }                               from '@Redux/store';
import type { QueryPanel }                              from '@Types/Layout';
import type { LayoutRecord }                            from '../types';

import { createAction, createReducer, createSelector }  from '@reduxjs/toolkit';


// Action Creators
const toggleQueryPanel          = createAction          ('layout/toggleQueryPanel');
const closeQueryPanel           = createAction          ('layout/closeQueryPanel');
const openQueryPanel            = createAction          ('layout/openQueryPanel');
const setQueryPanelDisplayWidth = createAction<number | { display: number, previous: number }>  ('layout/setQueryPanelDisplayWidth');

// Selectors
const selectQueryPanel = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.layout],
  (layout) => layout.queryPanel,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Reducer
const reducer = createReducer({} as LayoutRecord, (builder) => {
  builder
    .addCase(toggleQueryPanel,
      function(state: LayoutRecord) {
        state.queryPanel.isClosed = !state.queryPanel.isClosed;
      }
    )
    .addCase(closeQueryPanel,
      function(state: LayoutRecord) {
        state.queryPanel.isClosed = true;
      }
    )
    .addCase(openQueryPanel,
      function(state: LayoutRecord) {
        state.queryPanel.isClosed = false;
      }
    )
    .addCase(setQueryPanelDisplayWidth,
      function(state: LayoutRecord, action: PayloadAction<number | { display: number, previous: number }>) {
        if (typeof action.payload === 'number') {
          state.queryPanel.displayWidth = action.payload;
          state.queryPanel.previousWidth = action.payload;
        } else {
          const { display, previous } = action.payload;
          state.queryPanel.displayWidth = display;
          state.queryPanel.previousWidth = previous;
        }
      }
    );
});


export {
  toggleQueryPanel,
  closeQueryPanel,
  openQueryPanel,
  setQueryPanelDisplayWidth,
  selectQueryPanel
};
export default reducer;
