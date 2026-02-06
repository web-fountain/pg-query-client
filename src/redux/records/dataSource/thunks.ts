import type { RootState } from '@Redux/store';
import type { UUIDv7 }    from '@Types/primitives';

import { createAsyncThunk }                   from '@reduxjs/toolkit';
import * as log                               from '@Observability/client/thunks';

import { deleteDataSourceAction }             from '@OpSpaceDataSourceActions';
import { removeDataSourceRecord }             from '@Redux/records/dataSource';
import { errorEntryFromActionError, updateError } from '@Redux/records/errors';
import { clearTabsConnectionByCredentialId }  from '@Redux/records/tabbar';


type DeleteDataSourceResult = {
  deleted: boolean;
};

export const deleteDataSourceThunk = createAsyncThunk<DeleteDataSourceResult, { dataSourceId: UUIDv7 }, { state: RootState }>(
  'dataSource/deleteDataSourceThunk',
  async ({ dataSourceId }, { dispatch, getState }) => {
    const state                   = getState();
    const dataSourceRecord        = state.dataSourceRecords.byId[dataSourceId];
    const dataSourceCredentialId  = dataSourceRecord?.dataSourceCredentialId ?? null;

    log.thunkStart({
      thunk : 'dataSource/deleteDataSourceThunk',
      input : { dataSourceId }
    });

    let actionResult;
    try {
      actionResult = await deleteDataSourceAction(dataSourceId);
    } catch (error) {
      log.thunkException({
        thunk   : 'dataSource/deleteDataSourceThunk',
        message : 'deleteDataSourceAction threw',
        error   : error,
        input   : { dataSourceId }
      });
      dispatch(updateError({
        actionType  : 'dataSource/deleteDataSourceThunk',
        message     : 'Failed to delete data source.',
        meta        : { error }
      }));
      return { deleted: false };
    }

    log.thunkResult({
      thunk  : 'dataSource/deleteDataSourceThunk',
      result : actionResult,
      input  : { dataSourceId }
    });

    if (!actionResult.success) {
      dispatch(updateError(errorEntryFromActionError({
        actionType  : 'dataSource/deleteDataSourceThunk',
        error       : actionResult.error
      })));
      return { deleted: false };
    }

    dispatch(removeDataSourceRecord({ dataSourceId }));
    if (dataSourceCredentialId) {
      dispatch(clearTabsConnectionByCredentialId({ dataSourceCredentialId }));
    }

    return { deleted: true };
  }
);
