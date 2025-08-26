import type { PayloadAction }           from '@reduxjs/toolkit';
import type { RootState }               from '@Redux/store';
import type { RouteDirectory }          from '@Types/Layout';
import type { LayoutRecord }            from '../types';

import { createSelector, createSlice }  from '@reduxjs/toolkit';


const routeDirectorySlice = createSlice({
  name: 'routeDirectory',
  initialState: {} as LayoutRecord,
  reducers: {
    setRouteDirectory(state: LayoutRecord, action: PayloadAction<RouteDirectory>) {
      state.routeDirectory = action.payload;
    }
  }
});

// Selectors
export const selectRouteDirectory = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.layout.routeDirectory],
  (routeDirectory: RouteDirectory) => routeDirectory,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);


export const {
  setRouteDirectory
} = routeDirectorySlice.actions;
export default routeDirectorySlice.reducer;
