import type { LayoutRecord } from './types';

import { createReducer }          from '@reduxjs/toolkit';

import primarySidepanelReducer    from './primarySidepanel';
import secondarySidepanelReducer  from './secondarySidepanel';
import queryPanelReducer          from './queryPanel';
import routeDirectoryReducer      from './routeDirectory';



const initialState: LayoutRecord = {
  primarySidepanel: {
    isClosed      : false,
    displayWidth  : 300,    // default
    previousWidth : 300,    // default
    position      : 'left'  // default
  },
  secondarySidepanel: {
    isClosed      : true,
    displayWidth  : 300,    // default
    previousWidth : 300,    // default
    position      : 'right' // default
  },
  queryPanel: {
    isClosed      : true,
    displayWidth  : 600,    // default
    previousWidth : 600     // default
  },
  routeDirectory: {}
};

const reducer = createReducer(initialState, (builder) => {
  builder
    .addDefaultCase((state: LayoutRecord, action) => {
      primarySidepanelReducer   (state, action);
      secondarySidepanelReducer (state, action);
      queryPanelReducer         (state, action);
      routeDirectoryReducer     (state, action);
    });
});


export default reducer;
