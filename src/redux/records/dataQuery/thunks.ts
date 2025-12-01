import type { RootState }               from '@Redux/store';
import type { UUIDv7 }                  from '@Types/primitives';

import { createAsyncThunk }             from '@reduxjs/toolkit';
import {
  createNewUnsavedDataQuery,
  createNewUnsavedDataQueryFromFetch,
  markDataQuerySaved
}                                       from '@Redux/records/dataQuery';
import { addTabFromFetch }              from '@Redux/records/tabbar';
import { addUnsavedTreeNodeFromFetch }  from '@Redux/records/unsavedQueryTree';
import { renameNodeWithInvalidation }   from '@Redux/records/queryTree';
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

export const saveDataQueryThunk = createAsyncThunk<void, { dataQueryId: UUIDv7 }, { state: RootState }>(
  'dataQuery/saveDataQueryThunk',
  async ({ dataQueryId }, { getState, dispatch }) => {
    // AIDEV-NOTE: This thunk assumes all pending edits (name, queryText) have already been
    // dispatched to Redux via updateDataQueryName/updateDataQueryText before being called.
    const { dataQueryRecords } = getState();
    const record = dataQueryRecords[dataQueryId];
    if (!record || !record.unsaved?.update) return;

    // AIDEV-NOTE: At this point, latest name/queryText edits should already be captured
    // in record.unsaved.update via write-time reducers (e.g., updateDataQueryName/Text).
    const payload = record.unsaved.update;

    // AIDEV-NOTE: Optimistic update - update queryTree immediately if name changed.
    // This gives instant UI feedback before the backend call completes.
    // The reducer computes if resort is needed and sets pendingInvalidations.
    if (payload.name) {
      dispatch(renameNodeWithInvalidation({ dataQueryId, name: payload.name }));
    }

    try {
      console.log('[saveDataQueryThunk] updateDataQuery', payload);
      const res = await updateDataQuery(payload);
      if (res?.success) {
        dispatch(markDataQuerySaved(payload));
      } else {
        console.error(`Save failed for dataQueryId: ${dataQueryId}`);
        // AIDEV-TODO: Consider rollback of optimistic update on failure
        return;
      }
    } catch (error) {
      console.error(`Server Error saving dataQueryId: ${dataQueryId}`, error);
      // AIDEV-TODO: Consider rollback of optimistic update on failure
      return;
    }
  }
);
