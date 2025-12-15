// AIDEV-NOTE: Centralized UI focus intent state.
// This allows us to distinguish "create new unsaved query (focus editor)" from
// "select existing query (keep focus where the user clicked)".

import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@Redux/store';

import {
  createAction,
  createReducer,
  createSelector
} from '@reduxjs/toolkit';


type UIFocusRecord = {
  sqlEditorAutofocusRequestId : number;
  sqlEditorAutofocusHandledId : number;
};

// Actions
export const requestSqlEditorAutofocus  = createAction                        ('uiFocus/requestSqlEditorAutofocus');
export const ackSqlEditorAutofocus      = createAction<{ requestId: number }> ('uiFocus/ackSqlEditorAutofocus');


// Selectors
export const selectPendingSqlEditorAutofocusRequestId = createSelector.withTypes<RootState>()(
  [
    (state) => state.uiFocus.sqlEditorAutofocusRequestId,
    (state) => state.uiFocus.sqlEditorAutofocusHandledId
  ],
  (requestId, handledId) => {
    if (requestId > handledId) return requestId;
    return null;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);


// Reducer
const initialState: UIFocusRecord = {
  sqlEditorAutofocusRequestId : 0,
  sqlEditorAutofocusHandledId : 0
};

export default createReducer(initialState, (builder) => {
  builder
    .addCase(requestSqlEditorAutofocus, (state: UIFocusRecord) => {
      state.sqlEditorAutofocusRequestId = state.sqlEditorAutofocusRequestId + 1;
    })
    .addCase(ackSqlEditorAutofocus, (state: UIFocusRecord, action: PayloadAction<{ requestId: number }>) => {
      const requestId = action.payload.requestId;
      if (typeof requestId !== 'number') return;
      if (requestId > state.sqlEditorAutofocusHandledId) {
        state.sqlEditorAutofocusHandledId = requestId;
      }
    });
});


// TODO: add a last group focused to the state
// the 'group' is similar to the 'editor group' in an IDE
