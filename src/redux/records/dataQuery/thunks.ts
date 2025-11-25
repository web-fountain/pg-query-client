import type { RootState }               from '@Redux/store';
import type { DataQuery }               from '@Redux/records/dataQuery/types';
import type { Base64Url22, UUIDv7 }     from '@Types/primitives';

import { createAsyncThunk }             from '@reduxjs/toolkit';
import {
  createNewUnsavedDataQuery,
  createNewUnsavedDataQueryFromFetch,
  markDataQuerySaved
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
      console.error(`Error creating dataQueryId: ${dataQueryId}`, error);
      return;
    }
  }
);


type SaveArgs = {
  dataQueryId: UUIDv7;
};
// AIDEV-NOTE: Save minimal fields using server action; Redux is the source of truth.
export const saveDataQueryThunk = createAsyncThunk<void, SaveArgs, { state: RootState }>(
  'dataQuery/save',
  async ({ dataQueryId }, { getState, dispatch }) => {
    const { dataQueryRecords } = getState();
    const record = dataQueryRecords[dataQueryId];
    let payload: { dataQueryId: string; name?: string; queryText?: string } = { dataQueryId };

    if (record.unsaved?.create) {
      const candidate = record.unsaved.create as { dataQueryId: string; name?: string; queryText?: string };
      payload = {
        dataQueryId : candidate.dataQueryId,
        name        : candidate.name,
        queryText   : candidate.queryText
      };

      try {
        console.log('[saveDataQueryThunk] createDataQuery', payload);
        const res = await createDataQuery(payload as DataQuery);
        if (res?.success) {
          dispatch(markDataQuerySaved({ dataQueryId, name: payload.name, queryText: payload.queryText }));
          // New item: refresh the 'queries' root so the item appears with correct order.
          // If you have a proper thunk that fetches children, call it here.
          // Example if you wire it:
          // await dispatch(getQueryTreeNodeChildrenThunk({ nodeId: 'queries' })).unwrap();
        } else {
          // TODO: handle error - TOAST msg?
          console.error(`Save failed for dataQueryId: ${dataQueryId}`);
          return;
        }
      } catch (error) {
        console.error(`Error saving dataQueryId: ${dataQueryId}`, error);
        return;
      }
    }
    if (record.unsaved?.update) {
      const candidate = record.unsaved.update as { dataQueryId: string; name?: string; queryText?: string };
      payload = {
        dataQueryId : candidate.dataQueryId,
        name        : candidate.name,
        queryText   : candidate.queryText
      };

      try {
        console.log('[saveDataQueryThunk] updateDataQuery', payload);
        const res = await updateDataQuery(payload as DataQuery);
        if (res?.success) {
          dispatch(markDataQuerySaved({
            dataQueryId,
            name: payload.name,
            queryText: payload.queryText
          }));
          // Rename and re-sort affected nodes client-side for immediate UI update
          const state = getState();
          const nextName = payload.name ?? state.dataQueryRecords?.[dataQueryId]?.current?.name ?? 'Untitled';
          const nodeIds = (state.queryTree?.nodeIdsByDataQueryId?.[dataQueryId] || []) as Base64Url22[];
          nodeIds.forEach((nodeId: Base64Url22) => {
            const parentId = (state.queryTree?.nodes?.[nodeId]?.parentNodeId as Base64Url22 | null) || 'queries';
            dispatch(renameNode({ id: nodeId, name: nextName }));
            dispatch(resortChildren({ parentId: parentId as string }));
          });
        } else {
          // TODO: handle error - TOAST msg?
          console.error(`Save failed for dataQueryId: ${dataQueryId}`);
          return;
        }
      } catch (error) {
        console.error(`Error saving dataQueryId: ${dataQueryId}`, error);
        return;
      }
    }

    // Query text: allow empty string, but limit to 1,048,576 bytes
    // if (Object.prototype.hasOwnProperty.call(payload, 'queryText')) {
    //   const text = payload.queryText ?? '';
    //   try {
    //     const bytes = new TextEncoder().encode(text).length;
    //     if (bytes > 1048576) {
    //       console.warn('[save] queryText exceeds 1048576 bytes.');
    //       return;
    //     }
    //   } catch {
    //     // Fallback conservative check (length is chars, not bytes)
    //     if ((text || '').length > 1048576) {
    //       console.warn('[save] queryText likely exceeds 1048576 bytes.');
    //       return;
    //     }
    //   }
    // }

    // AIDEV-NOTE: Mock implementation - wait 2 seconds then return success
    // await new Promise(resolve => setTimeout(resolve, 2000));
    // dispatch(markDataQuerySaved({ dataQueryId }));
  }
);

/**
This thunk handles the saving of the data query content.
The caller calls with only the dataQueryId.

The thunk's only responsibility is to identify the unsaved data for the dataQueryId,
verify there is data to be saved, and then call the function to save the data.

Wait for the response, handle the response, and modify the Redux state accordingly.
The UI component subscribes to the redux state and will respond to the changes.

 */
