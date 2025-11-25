import type { PayloadAction }           from '@reduxjs/toolkit';
import { createAction, createReducer }  from '@reduxjs/toolkit';


type UrlState = {
  opspaceId   : string | null;
  dataQueryId : string | null;
  initialized : boolean;
};

const initialState: UrlState = {
  opspaceId   : null,
  dataQueryId : null,
  initialized : false
};

// Actions
const rehydrateUrl  = createAction<{ opspaceId: string; dataQueryId: string }>('url/rehydrate');
const clearUrl      = createAction                                       ('url/clear');

// Reducer
const reducer = createReducer(initialState, (builder) => {
  builder
    .addCase(rehydrateUrl,
      function(state: UrlState, action: PayloadAction<{ opspaceId: string; dataQueryId: string }>) {
        state.opspaceId = action.payload.opspaceId;
        state.dataQueryId = action.payload.dataQueryId;
        state.initialized = true;
    })
    .addCase(clearUrl,
      function(state: UrlState) {
        state.opspaceId = null;
        state.dataQueryId = null;
        state.initialized = false;
      }
    )
});


export type { UrlState };
export { rehydrateUrl, clearUrl };
export default reducer;
