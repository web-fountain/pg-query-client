import type { Base64Url22, UUIDv7 } from '@Types/primitives';


export type DataQueryTab = {
  dataQueryId : UUIDv7;
  name        : string;
  queryText   : string;   // last saved queryText (not drafts)
  createdAt   : string;   // ISO 8601 (timestamptz)
  updatedAt   : string;   // ISO 8601 (timestamptz)
};

export type OpSpaceTabsState = {
  opspaceId    : Base64Url22;
  openTabs     : DataQueryTab[];  // tabs currently visible/open in UI
  lastActiveId : UUIDv7;          // which tab to activate
};

export type NewDataQueryInput = {
  opspaceId         : Base64Url22;
  name?             : string;
  initialQueryText? : string;
  dataQueryId?      : UUIDv7;
};

export type DataQueryLifecycleInput = {
  opspaceId   : Base64Url22;
  dataQueryId : UUIDv7;
  name?       : string;
};

export type SaveDataQueryInput = {
  opspaceId   : Base64Url22;
  dataQueryId : UUIDv7;
  name        : string;
  queryText   : string;
};

// AIDEV-NOTE: SQL drafts moved to dataQueryRecords; tabs keep only nameDraft locally.
export type TabDrafts = Record<UUIDv7, { nameDraft?: string }>;
