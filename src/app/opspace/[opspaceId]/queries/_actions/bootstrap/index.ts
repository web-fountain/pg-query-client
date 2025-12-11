'use server';

import type { UUIDv7 }                      from '@Types/primitives';
import type { DataQuery, DataQueryRecord }  from '@Redux/records/dataQuery/types';
import type { TabbarRecord }                from '@Redux/records/tabbar/types';
import type { QueryTreeRecord }             from '@Redux/records/queryTree/types';
import type { UnsavedQueryTreeRecord }      from '@Redux/records/unsavedQueryTree/types';

import { listDataQueries }                  from '../queries';
import {
  buildInitialQueryTree,
  buildInitialUnsavedQueryTree
}                                           from '../queryTree';
import { listOpenTabs }                     from '../tabs';


type WorkspaceBootstrap = {
  tabs            : TabbarRecord;
  dataQueryRecords: DataQueryRecord;
  queryTree       : QueryTreeRecord;
  unsavedQueryTree: UnsavedQueryTreeRecord;
};

async function bootstrapWorkspace(): Promise<{ success: boolean; data?: WorkspaceBootstrap }> {
  // AIDEV-NOTE: Phase 1 bootstrap aggregator. This function centralizes the
  // existing server actions used to hydrate the opspace workspace on first
  // render. It does not alter routing behavior or create new unsaved queries;
  // later phases will layer those behaviors on top.
  try {
    const [
      tabsResult,
      queriesResult,
      queryTreeResult,
      unsavedTreeResult
    ] = await Promise.all([
      listOpenTabs(),
      listDataQueries(),
      buildInitialQueryTree(),
      buildInitialUnsavedQueryTree()
    ]);

    if (!tabsResult.success || !queryTreeResult.success || !unsavedTreeResult.success || !queriesResult.success) {
      console.error('[bootstrapWorkspace] One or more bootstrap actions failed', {
        tabsSuccess        : tabsResult.success,
        queriesSuccess     : queriesResult.success,
        queryTreeSuccess   : queryTreeResult.success,
        unsavedTreeSuccess : unsavedTreeResult.success
      });
      return { success: false };
    }

    const tabs             = tabsResult.data        as TabbarRecord;
    const queryTree        = queryTreeResult.data   as unknown as QueryTreeRecord;
    const unsavedQueryTree = unsavedTreeResult.data as unknown as UnsavedQueryTreeRecord;
    const queries          = queriesResult.data     as DataQuery[] | undefined;

    // AIDEV-NOTE: Backend listDataQueries now returns only DataQueries for
    // open tabs (saved + unsaved). Build the DataQueryRecord directly from
    // this filtered list so Redux has per-id records for all open tabs.
    const dataQueryRecords: DataQueryRecord = {};
    if (queries && queries.length > 0) {
      for (const query of queries) {
        const dataQueryId = query.dataQueryId as UUIDv7 | undefined;
        if (!dataQueryId) continue;

        dataQueryRecords[dataQueryId] = {
          current   : query,
          persisted : query,
          unsaved   : {},
          isUnsaved : false,
          isInvalid : false,
          invalid   : {}
        };
      }
    }

    return {
      success: true,
      data   : {
        tabs,
        dataQueryRecords,
        queryTree,
        unsavedQueryTree
      }
    };
  } catch (error) {
    console.error('[bootstrapWorkspace] Unexpected error', error);
    return { success: false };
  }
}


export { bootstrapWorkspace };
export type { WorkspaceBootstrap };
