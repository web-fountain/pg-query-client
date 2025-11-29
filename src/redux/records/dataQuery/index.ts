import type { PayloadAction }     from '@reduxjs/toolkit';
import type { RootState }         from '@Redux/store';
import type { Extension, UUIDv7 } from '@Types/primitives';
import type {
  DataQuery,
  DataQueryRecord,
  DataQueryRecordItem,
  CreateDataQuery,
  UpdateDataQuery,
  UpdateDataQueryName,
  UpdateDataQueryText
}                                 from './types';
import type { InvalidMap }        from './types';

import {
  createAction, createReducer,
  createSelector,
}                                 from '@reduxjs/toolkit';
import {
  mergeAllowedChanges,
  buildUpdatePayload
}                                 from '@Utils/writeTime';
import {
  validateDataQueryName,
  validateDataQueryText,
  validateDataQueryUpdate
}  from './validation';


export type CreateNewDataQuery = {
  dataQueryId: UUIDv7;
  name: string;
  ext: string;
  tab: {
    groupId: number;
    tabId: UUIDv7;
    position: number;
  },
  tree: {
    root: string;
    groupdId: number;
    tabId: UUIDv7;
    position: number;
  }
};

export type CreateNewUnsavedDataQuery = {
  dataQueryId : UUIDv7;
  name        : string;
  ext         : Extension;
};

// Action Creators
export const seedDataQueryFromActiveTab = createAction<DataQuery>           ('dataQuery/seedDataQueryFromActiveTab');
export const setDataQueryRecord         = createAction<DataQuery>           ('dataQuery/setDataQueryRecord');

export const createDataQuery            = createAction<CreateDataQuery>     ('dataQuery/createDataQuery');
export const createNewUnsavedDataQuery  = createAction<CreateNewUnsavedDataQuery>  ('dataQuery/createNewUnsavedDataQuery');
export const createNewUnsavedDataQueryFromFetch = createAction<CreateNewUnsavedDataQuery>  ('dataQuery/createNewUnsavedDataQueryFromFetch');

export const updateDataQuery            = createAction(
  'dataQuery/updateDataQuery',
  (payload: UpdateDataQuery) => {
    const result = validateDataQueryUpdate(payload);
    const meta: { invalid?: InvalidMap } = {};

    if (!result.ok) {
      // AIDEV-NOTE: Map AJV field errors to InvalidMap entries for name/queryText.
      const invalid: InvalidMap = {};

      for (const err of result.errors) {
        const rawPath = err.path || '';
        const key = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;

        if (key === 'name' || key === 'queryText') {
          const field = key as 'name' | 'queryText';
          invalid[field] = {
            field,
            actionType: 'dataQuery/updateDataQuery',
            message   : err.message,
            schemaId  : 'UpdateDataQuery'
          };
        }
      }

      // If only the anyOf constraint failed (no name/queryText specific errors),
      // treat it as both fields missing so UI can surface a useful message.
      if (!invalid.name && !invalid.queryText) {
        const anyOfErr = result.errors.find(
          (e) => (e.path || '') === '' && e.message === 'At least one of name or queryText must be provided'
        );

        if (anyOfErr) {
          invalid.name = {
            field     : 'name',
            actionType: 'dataQuery/updateDataQuery',
            message   : anyOfErr.message,
            schemaId  : 'UpdateDataQuery'
          };
          invalid.queryText = {
            field     : 'queryText',
            actionType: 'dataQuery/updateDataQuery',
            message   : anyOfErr.message,
            schemaId  : 'UpdateDataQuery'
          };
        }
      }

      if (Object.keys(invalid).length > 0) {
        meta.invalid = invalid;
      }
    }

    return { payload, meta };
  }
);
export const updateDataQueryName        = createAction(
  'dataQuery/updateDataQueryName',
  (payload: UpdateDataQueryName) => {
    // AIDEV-NOTE: Validate name field; map errors to invalid.name for reducer consumption
    const result = validateDataQueryName(payload);
    const meta: { invalid?: InvalidMap } = {};

    if (!result.ok) {
      const fieldErr  = result.errors[0];
      meta.invalid   = {
        ['name']: {
          field     : 'name',
          actionType: 'dataQuery/updateDataQueryName',
          message   : fieldErr.message,
          schemaId  : 'UpdateDataQueryName'
        }
      };

      return { payload, meta };
    }

    return { payload, meta };
  }
);
export const updateDataQueryText        = createAction(
  'dataQuery/updateDataQueryText',
  (payload: UpdateDataQueryText) => {
    // AIDEV-NOTE: Validate queryText field; map errors to invalid.queryText for reducer consumption
    const result = validateDataQueryText(payload);
    const meta: { invalid?: InvalidMap } = {};

    if (!result.ok) {
      const fieldErr  = result.errors[0];
      meta.invalid   = {
        ['queryText']: {
          field     : 'queryText',
          actionType: 'dataQuery/updateDataQueryText',
          message   : fieldErr.message,
          schemaId  : 'UpdateDataQueryText'
        }
      };

      return { payload, meta };
    }

    return { payload, meta };
  }
);
export const updateDataQueryIsUnsaved   = createAction<{ dataQueryId: UUIDv7 }    >   ('dataQuery/updateDataQueryIsUnsaved');
export const markDataQuerySaved         = createAction<{ dataQueryId: UUIDv7, name?: string, queryText?: string }>   ('dataQuery/markDataQuerySaved');

// Selectors
export const selectDataQueries      = createSelector.withTypes<RootState>()(
  [(state: RootState)                 => state.dataQueryRecords],
  (dataQueryRecords): DataQueryRecord => dataQueryRecords,
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectDataQueryRecord  = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                       => state.dataQueryRecords,
    (_state: RootState, dataQueryId: string) => dataQueryId
  ],
  (dataQueryRecords, dataQueryId): DataQueryRecordItem | undefined => {
    if (dataQueryId && dataQueryRecords && dataQueryRecords[dataQueryId]) {
      return dataQueryRecords[dataQueryId];
    }
    return undefined;
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

export const selectDataQueryUnsaved = createSelector.withTypes<RootState>()(
  [
    (state: RootState)                      => state.dataQueryRecords,
    (state: RootState, dataQueryId: string) => dataQueryId
  ],
  (dataQueryRecords, dataQueryId) => {
    if (dataQueryRecords && dataQueryRecords[dataQueryId]) {
      return {
        isUnsaved: dataQueryRecords[dataQueryId].isUnsaved,
        unsaved: dataQueryRecords[dataQueryId].unsaved
      };
    }

    return {
      isUnsaved: false,
      unsaved: {}
    };
  },
  { devModeChecks: { identityFunctionCheck: 'never' } }
);

// Write-time change tracker. Captures minimal fields changed and updates isUnsaved/unsaved.
function markChanged(state: DataQueryRecord, dataQueryId: UUIDv7, changes: Partial<{ name: string; queryText: string }>): void {
  if (!state.changesById) state.changesById = {};
  const prev = state.changesById[dataQueryId] || {};
  const allowed = ['name', 'queryText'] as const;
  const next = mergeAllowedChanges(prev, changes, allowed as unknown as readonly string[]);
  state.changesById[dataQueryId] = next;

  const record = state[dataQueryId];
  if (!record) return;

  const hasChanges = Object.keys(next).length > 0;

  if (record.persisted) {
    // AIDEV-NOTE: Update-phase: track minimal update payload.
    record.isUnsaved = hasChanges;
    record.unsaved = hasChanges ? buildUpdatePayload('dataQueryId', dataQueryId, next) : {};
  } else {
    // AIDEV-NOTE: Create-phase: preserve and update create payload; never overwrite with update.
    record.isUnsaved = true;
    const createObj = {
      dataQueryId,
      ...(record.unsaved?.create || {})
    } as { dataQueryId: UUIDv7; name?: string; queryText?: string };

    if (Object.hasOwn(changes, 'name')) {
      createObj.name = changes.name as string;
    }
    if (Object.hasOwn(changes, 'queryText')) {
      createObj.queryText = changes.queryText as string;
    }

    // Default any missing fields from current to keep create payload usable
    if (createObj.name === undefined) createObj.name = record.current?.name;
    if (createObj.queryText === undefined) createObj.queryText = record.current?.queryText;

    record.unsaved = { ...record.unsaved, create: createObj };
  }
}

// Reducer
const initialState: DataQueryRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(seedDataQueryFromActiveTab,
      function(state: DataQueryRecord, action: PayloadAction<DataQuery>) {
        const { dataQueryId } = action.payload;
        state[dataQueryId] = {
          current: action.payload,
          persisted: {},
          unsaved: {},
          isUnsaved: false,
          isInvalid: false,
          invalid: {}
        };
      }
    )
    .addCase(createNewUnsavedDataQuery,
      function(state: DataQueryRecord, action: PayloadAction<CreateNewUnsavedDataQuery>) {
        const { dataQueryId, name, ext } = action.payload;

        state[dataQueryId] = {
          current: { dataQueryId, name, ext, queryText: '', description: '', tags: [], color: null },
          persisted: {},
          unsaved: {},
          isUnsaved: false,
          isInvalid: false,
          invalid: {}
        };
      }
    )
    .addCase(createNewUnsavedDataQueryFromFetch,
      function(state: DataQueryRecord, action: PayloadAction<CreateNewUnsavedDataQuery>) {
        const { dataQueryId, name, ext } = action.payload;
        const dataQuery = state[dataQueryId];

        state[dataQueryId] = {
          ...dataQuery,
          current: {
            ...dataQuery.current,
            dataQueryId, name, ext
          },
          persisted: { dataQueryId, name, ext }
        };
      }
    )
    .addCase(setDataQueryRecord,
      function(state: DataQueryRecord, action: PayloadAction<CreateDataQuery>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        // this action is ONLY called when there is data coming from the database.
        // if there is isUnsaved data, we need to update the persisted data
        // and perform a diff to recalculate the unsaved data
        if (dataQuery && dataQuery.isUnsaved) {
          dataQuery.persisted = action.payload;
        } else {
          state[dataQueryId] = {
            current   : { ...dataQuery?.current, ...action.payload },
            persisted : { ...dataQuery?.persisted, ...action.payload },
            unsaved   : {},
            isUnsaved : false,
            isInvalid : false,
            invalid: {}
          };
        }
      }
    )
    .addCase(markDataQuerySaved,
      function(state: DataQueryRecord, action: PayloadAction<{ dataQueryId: UUIDv7, name?: string, queryText?: string }>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.persisted = dataQuery.current;
          dataQuery.isUnsaved = false;
          dataQuery.unsaved = {};
          try { if (state.changesById) delete state.changesById[dataQueryId]; } catch {}
        }
      }
    )
    .addCase(createDataQuery,
      function(state: DataQueryRecord, action: PayloadAction<CreateDataQuery>) {
        const { dataQueryId, name } = action.payload;

        state[dataQueryId] = {
          current   : { dataQueryId, name, ext: 'sql', queryText: '', description: '', tags: [], color: null },
          persisted : {},
          unsaved   : {},
          isUnsaved : false,
          isInvalid : false,
          invalid   : {}
        };
      }
    )
    .addCase(updateDataQuery,
      function(state: DataQueryRecord, action) {
        const { dataQueryId, name, queryText } = action.payload;
        const record = state[dataQueryId];
        if (!record) return;

        const invalidName       = action.meta.invalid?.name;
        const invalidQueryText  = action.meta.invalid?.queryText;
        const hasNameProp       = Object.hasOwn(action.payload, 'name');
        const hasQueryTextProp  = Object.hasOwn(action.payload, 'queryText');

        if (hasNameProp)      record.current.name      = name      as string;
        if (hasQueryTextProp) record.current.queryText = queryText as string;

        if (invalidName || invalidQueryText) {
          invalidName
            ? record.invalid.name = invalidName
            : delete record.invalid.name;
          invalidQueryText
            ? record.invalid.queryText = invalidQueryText
            : delete record.invalid.queryText;

          let hasInvalid = false;
          for (const _ in record.invalid) { hasInvalid = true; break; }
          record.isInvalid = hasInvalid;
          return;
        }

        // No validation errors: clear field-level errors and update unsaved state
        delete record.invalid.name;
        delete record.invalid.queryText;

        let hasInvalid = false;
        for (const _ in record.invalid) { hasInvalid = true; break; }
        record.isInvalid = hasInvalid;

        const changed: Partial<{ name: string; queryText: string }> = {};
        if (hasNameProp) {
          changed.name = name as string;
        }
        if (hasQueryTextProp) {
          changed.queryText = queryText as string;
        }

        if (hasNameProp || hasQueryTextProp) {
          markChanged(state, dataQueryId, changed);
        }
      }
    )
    .addCase(updateDataQueryName,
      function(state: DataQueryRecord, action: ReturnType<typeof updateDataQueryName>) {
        const { dataQueryId, name } = action.payload;
        const record = state[dataQueryId];
        if (!record) return;
        if (name === record.current.name) return;

        const invalidName = action.meta.invalid?.name;

        if (invalidName) {
          // AIDEV-NOTE: Replace record with a new object so selector detects change
          state[dataQueryId] = {
            ...record,
            current: { ...record.current, name },
            isInvalid: true,
            invalid: { ...record.invalid, name: invalidName }
          };
          return;
        }

        // Valid: clear invalid.name if present
        const { name: _removed, ...restInvalid } = record.invalid || {};
        const hasInvalid = Object.keys(restInvalid).length > 0;

        state[dataQueryId] = {
          ...record,
          current: { ...record.current, name },
          isInvalid: hasInvalid,
          invalid: restInvalid
        };

        markChanged(state, dataQueryId, { name });
      }
    )
    .addCase(updateDataQueryText,
      function(state: DataQueryRecord, action: ReturnType<typeof updateDataQueryText>) {
        const { dataQueryId, queryText } = action.payload;
        const record = state[dataQueryId];
        if (!record) return;
        if (queryText === record.current.queryText) return;

        const invalidQueryText = action.meta.invalid?.queryText;

        if (invalidQueryText) {
          state[dataQueryId] = {
            ...record,
            current: { ...record.current, queryText },
            isInvalid: true,
            invalid: { ...record.invalid, queryText: invalidQueryText }
          };
          return;
        }

        // Valid: clear invalid.queryText if present
        const { queryText: _removed, ...restInvalid } = record.invalid || {};
        const hasInvalid = Object.keys(restInvalid).length > 0;

        state[dataQueryId] = {
          ...record,
          current: { ...record.current, queryText },
          isInvalid: hasInvalid,
          invalid: restInvalid
        };

        markChanged(state, dataQueryId, { queryText });
      }
    )
    .addCase(updateDataQueryIsUnsaved,
      function(state: DataQueryRecord, action: PayloadAction<{ dataQueryId: UUIDv7 }>) {
        const { dataQueryId } = action.payload;
        const dataQuery = state[dataQueryId];

        if (dataQuery) {
          dataQuery.isUnsaved = false;
          dataQuery.unsaved = {};
          try { if (state.changesById) delete state.changesById[dataQueryId]; } catch {}
        }
      }
    )
});
