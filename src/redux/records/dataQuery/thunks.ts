import type { RootState }               from '@Redux/store';
import type { DataQuery }               from '@Redux/records/dataQuery/types';
import type { Base64Url22, UUIDv7 }     from '@Types/primitives';

import { createAsyncThunk }             from '@reduxjs/toolkit';
import {
  createNewUnsavedDataQuery,
  createNewUnsavedDataQueryFromFetch,
  markDataQuerySaved,
  updateDataQueryText
}                                       from '@Redux/records/dataQuery';
import { addTabFromFetch }              from '@Redux/records/tabbar';
import { addUnsavedTreeNodeFromFetch }  from '@Redux/records/unsavedQueryTree';
import { renameNode, resortChildren }   from '@Redux/records/queryTree';
import {
  createNewUnsavedDataQueryAction,
  updateDataQuery
}                                       from '@/app/opspace/[opspaceId]/queries/[dataQueryId]/_actions/queries';


export const createNewUnsavedDataQueryThunk = createAsyncThunk<void, { dataQueryId: UUIDv7; name: string }, { state: RootState }>(
  'dataQuery/createNewUnsavedDataQueryThunk',
  async ({ dataQueryId, name }, { dispatch }) => {
    dispatch(createNewUnsavedDataQuery({ dataQueryId, name, ext: 'sql' }));

    const payload = { dataQueryId };
    try {
      console.log('[createNewQueryThunk] createNewQuery', payload);
      const res = await createNewUnsavedDataQueryAction(payload);

      if (res?.success && res.data) {
        const { dataQueryId, name, ext, tab, tree } = res.data;
        dispatch(createNewUnsavedDataQueryFromFetch({ dataQueryId, name, ext }));
        dispatch(addTabFromFetch({ tab }));
        dispatch(addUnsavedTreeNodeFromFetch({ tree }));
      } else {
        console.error(`Create failed for dataQueryId: ${dataQueryId}`);
        return;
      }
    } catch (error) {
      console.error(`Server Error creating dataQueryId: ${dataQueryId}`, error);
      return;
    }
  }
);

export const saveDataQueryThunk = createAsyncThunk<void, { dataQueryId: UUIDv7, queryText: string }, { state: RootState }>(
  'dataQuery/saveDataQueryThunk',
  async ({ dataQueryId, queryText }, { getState, dispatch }) => {
    if (typeof queryText === 'string') {
      dispatch(updateDataQueryText({ dataQueryId, queryText }));
    }

    const { dataQueryRecords } = getState();
    const record = dataQueryRecords[dataQueryId];
    if (!record || !record.unsaved?.update) return;

    const payload = record.unsaved.update;

    try {
      console.log('[saveDataQueryThunk] updateDataQuery', payload);
      const res = await updateDataQuery(payload);
      if (res?.success) {
        dispatch(markDataQuerySaved(payload));
      } else {
        console.error(`Save failed for dataQueryId: ${dataQueryId}`);
        return;
      }
    } catch (error) {
      console.error(`Server Error saving dataQueryId: ${dataQueryId}`, error);
      return;
    }
  }
);
