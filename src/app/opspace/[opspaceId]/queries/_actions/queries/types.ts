
import type { Extension, UUIDv7 }     from '@Types/primitives';
import type { DataQuery }             from '@Types/dataQuery';
import type { UnsavedQueryTreeNode }  from '@Types/unsavedQueryTree';
import type { QueryTreeNode }         from '@Types/queryTree';
import type { Tab }                   from '@Types/tabs';


// AIDEV-NOTE: Backend API response shapes for query server actions.
export type CreateNewUnsavedDataQueryPayload = {
  dataQueryId: UUIDv7;
  name?: string;
};

export type UpdateDataQueryPayload = {
  dataQueryId: UUIDv7;
  name?: string;
  queryText?: string;
};

export type ListDataQueriesApiResponse =
  | { ok: false }
  | { ok: true; data: DataQuery[] };

export type CreateUnsavedDataQueryResult = {
  dataQueryId: UUIDv7;
  name: string;
  ext: Extension;
  tab: {
    groupId: number;
    tabId: UUIDv7;
    mountId: UUIDv7;
    position: number;
  };
  tree: UnsavedQueryTreeNode;
};

export type CreateUnsavedDataQueryApiResponse =
  | { ok: false }
  | { ok: true; data: CreateUnsavedDataQueryResult };

export type UpdateDataQueryResult = {
  dataQueryId: UUIDv7;
  nodeId?: UUIDv7;
};

export type UpdateDataQueryApiResponse =
  | { ok: false }
  | { ok: true; data: UpdateDataQueryResult };

// AIDEV-NOTE: Backend API shape for creating a brand-new *saved* query (not an unsaved draft).
// This endpoint is intended for QueryTree "New File" creation where the query should appear
// immediately in the saved tree and be ready to open later.
export type CreateSavedDataQueryPayload = {
  dataQueryId     : UUIDv7;
  name            : string;
  parentFolderId? : string;
  tabGroup?       : number;
};

export type CreateSavedDataQueryResult = {
  dataQueryId : string;
  name        : string;
  ext         : string;
  tab: Tab;
  tree: QueryTreeNode;
};

export type CreateSavedDataQueryApiResponse =
  | { ok: false }
  | { ok: true; data: CreateSavedDataQueryResult };
