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

async function buildDataQueryRecordsForOpenTabs(tabs: TabbarRecord, queries: DataQuery[] | undefined): Promise<DataQueryRecord> {
  // AIDEV-NOTE: Build a minimal DataQueryRecord containing only queries that are
  // currently referenced by open tabs. This keeps the initial Redux payload
  // small while we rely on the existing /queries endpoint. A later phase can
  // swap this to a dedicated \"queries-for-open-tabs\" backend endpoint.
  const record: DataQueryRecord = {};

  if (!queries || !tabs || !tabs.tabIds || !tabs.entities) {
    return record;
  }

  const openMountIds = new Set<UUIDv7>();
  for (const tabId of tabs.tabIds) {
    const tab = tabs.entities[tabId];
    if (tab && tab.mountId) {
      openMountIds.add(tab.mountId);
    }
  }

  if (openMountIds.size === 0) {
    return record;
  }

  for (const query of queries) {
    const dataQueryId = query.dataQueryId as UUIDv7 | undefined;
    if (!dataQueryId) continue;
    if (!openMountIds.has(dataQueryId)) continue;

    record[dataQueryId] = {
      current   : query,
      persisted : query,
      unsaved   : {},
      isUnsaved : false,
      isInvalid : false,
      invalid   : {}
    };
  }

  return record;
}

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

    const tabs              = tabsResult.data        as TabbarRecord;
    const queryTree         = queryTreeResult.data   as unknown as QueryTreeRecord;
    const unsavedQueryTree  = unsavedTreeResult.data as unknown as UnsavedQueryTreeRecord;
    const queries           = queriesResult.data     as DataQuery[] | undefined;

    const dataQueryRecords  = await buildDataQueryRecordsForOpenTabs(tabs, queries);

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
