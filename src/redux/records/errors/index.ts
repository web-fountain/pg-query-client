import type { PayloadAction }           from '@reduxjs/toolkit';
import type { RootState }               from '@Redux/store';
import type { ErrorEntry, ErrorsState } from './types';

import {
  createAction,
  createReducer,
  createSelector
}                                       from '@reduxjs/toolkit';
import { generateBase64Url22 }          from '@Utils/generateId';


export { errorEntryFromActionError }    from './adapters';
export type { ErrorEntry, ErrorsState } from './types';

// Action Creators
export const updateError = createAction(
  'errors/report',
  (payload: Omit<ErrorEntry, 'id' | 'createdAt'>) => {
    // Prefer the ActionError id when present so UI/debugging can correlate
    // Redux errors with server action logs. Fall back to a new id for generic errors.
    const id = payload.actionError?.id || generateBase64Url22();
    const createdAt = Date.now();
    return { payload: { id, createdAt, ...payload }, meta: { _routedError: true } };
  }
);

// Selectors
export const selectErrorsState = createSelector.withTypes<RootState>()(
  [state => state.errors],
  (errors): ErrorsState => errors,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectLastError = createSelector.withTypes<RootState>()(
  [state => state.errors],
  (errors) => (errors.last ? errors.byId[errors.last] : undefined),
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// Reducer
const initialState: ErrorsState = { byId: {}, last: null };

// AIDEV-NOTE: Errors are append-only in byId; last holds the most recent id for UX to subscribe.
export default createReducer(initialState, (builder) => {
  builder
    .addCase(updateError,
      function(state: ErrorsState, action: PayloadAction<ErrorEntry>) {
        state.byId[action.payload.id] = action.payload;
        state.last = action.payload.id;
      }
    );
});
