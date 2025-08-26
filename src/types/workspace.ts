export type UUID = string;

export type QueryTab = {
  id: UUID;            // queryId
  name: string;
  sql: string;         // last saved SQL (not drafts)
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
};

export type ClientTabsState = {
  clientId: UUID;
  openTabs: QueryTab[];      // tabs currently visible/open in UI
  lastActiveId: UUID;        // which tab to activate
};

export type NewQueryInput = {
  clientId: UUID;
  name?: string;
  initialSql?: string;
  queryId?: UUID;
};

export type QueryLifecycleInput = {
  clientId: UUID;
  queryId: UUID;
  name?: string;
};

export type SaveQueryInput = {
  clientId: UUID;
  queryId: UUID;
  name: string;
  sql: string;
};

export type QueryWorkspaceProps = {
  clientId: UUID;
  initialTabs: QueryTab[];
  initialActiveId: UUID;
};

// Local-only ephemeral drafts keyed by query id
export type TabDrafts = Record<UUID, { sqlDraft?: string; nameDraft?: string }>;
