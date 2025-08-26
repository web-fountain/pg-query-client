import type { PayloadAction }           from '@reduxjs/toolkit';
import { createAction, createReducer }  from '@reduxjs/toolkit';


type RouteState = {
  clientId: string | null;
  queryId: string | null;
  initialized: boolean;
};

const initialState: RouteState = {
  clientId: null,
  queryId: null,
  initialized: false
};

// Actions
const rehydrateRoute  = createAction<{ clientId: string; queryId: string }>('route/rehydrate');
const clearRoute      = createAction                                       ('route/clear');

// Reducer
const reducer = createReducer(initialState, (builder) => {
  builder
    .addCase(rehydrateRoute, function(state: RouteState, action: PayloadAction<{ clientId: string; queryId: string }>) {
      state.clientId = action.payload.clientId;
      state.queryId = action.payload.queryId;
      state.initialized = true;
    })
    .addCase(clearRoute, function(state: RouteState) {
      state.clientId = null;
      state.queryId = null;
      state.initialized = false;
    });
});


export type { RouteState };
export { rehydrateRoute, clearRoute };
export default reducer;
