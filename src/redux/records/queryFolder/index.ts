import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState }     from '@Redux/store';
import type {
  QueryFolder, QueryFolderRecord, SaveQueryFolder
}                             from './types';
import {
  createAction, createReducer,
  createSelector
}                             from '@reduxjs/toolkit';

import {
  mergeAllowedChanges,
  buildUpdatePayload
}                             from '@Utils/writeTime';


// Action Creators
export const setQueryFolderRecord     = createAction<QueryFolder> ('queryFolderRecord/setQueryFolderRecord');
export const createQueryFolderRecord  = createAction<QueryFolder> ('queryFolderRecord/createQueryFolderRecord');
export const updateQueryFolderRecord  = createAction<QueryFolder> ('queryFolderRecord/updateQueryFolderRecord');
export const deleteQueryFolderRecord  = createAction<string[]>    ('queryFolderRecord/deleteQueryFolderRecord');

// Selectors
export const selectQueryFolders = createSelector.withTypes<RootState>()(
  [(state: RootState) => state.queryFolderRecords],
  (queryFolderRecords): QueryFolderRecord => queryFolderRecords,
  {
    devModeChecks: { identityFunctionCheck: 'never' }
  }
);

// Write-time change tracker. Captures minimal fields changed and updates isUnsaved/unsaved.
function markChanged(state: QueryFolderRecord, queryFolderId: string, changes: Partial<{ name: string; description: string; tags: string; color: string }>): void {
  if (!state.changesById) state.changesById = {};
  const prev = state.changesById[queryFolderId] || {};
  const allowed = ['name', 'description', 'tags', 'color'] as const;
  const next = mergeAllowedChanges(prev, changes, allowed as unknown as readonly string[]);
  state.changesById[queryFolderId] = next;

  const record = state[queryFolderId];
  if (!record) return;

  const hasChanges = Object.keys(next).length > 0;

  if (record.persisted) {
    // AIDEV-NOTE: Update-phase: track minimal update payload.
    record.isUnsaved = hasChanges;
    record.unsaved = hasChanges ? buildUpdatePayload('queryFolderId', queryFolderId, next) : {};
  } else {
    // AIDEV-NOTE: Create-phase: preserve and update create payload; never overwrite with update.
    record.isUnsaved = true;
    const createObj = {
      queryFolderId,
      ...(record.unsaved?.create || {})
    } as { queryFolderId: string; name?: string; description?: string; tags?: string[]; color?: string };

    if (Object.prototype.hasOwnProperty.call(changes, 'name')) {
      createObj.name = changes.name as string;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'description')) {
      createObj.description = changes.description as string;
    }

    // Default any missing fields from current to keep create payload usable
    if (createObj.name === undefined) createObj.name = record.current?.name;
    if (createObj.description === undefined) createObj.description = record.current?.description;
    if (createObj.tags === undefined) createObj.tags = record.current?.tags;
    if (createObj.color === undefined) createObj.color = record.current?.color;

    record.unsaved = { ...record.unsaved, create: createObj as SaveQueryFolder['create'] };
  }
}

const initialState: QueryFolderRecord = {};
export default createReducer(initialState, (builder) => {
  builder
    .addCase(setQueryFolderRecord,
      function(state: QueryFolderRecord, action: PayloadAction<QueryFolder>) {
        const { queryFolderId } = action.payload;
        const queryFolder = state[queryFolderId];

        if (queryFolder && queryFolder.isUnsaved) {
          queryFolder.persisted = action.payload;
        } else {
          state[queryFolderId] = {
            current   : action.payload,
            persisted : action.payload,
            unsaved   : {},
            isUnsaved : false,
            isInvalid : false
          }
        }
      }
    )
    .addCase(createQueryFolderRecord,
      function(state: QueryFolderRecord, action: PayloadAction<QueryFolder>) {
        const { queryFolderId, ...rest } = action.payload;
        state[queryFolderId] = {
          current   : { queryFolderId, ...rest },
          persisted : {},
          unsaved   : { create: { queryFolderId, ...rest } },
          isUnsaved : true,
          isInvalid : false
        }
      }
    )
});
