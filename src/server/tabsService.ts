import type { UUID, ClientTabsState, QueryTab } from '@/types/workspace';
import { isUuidV4 } from '@/utils/uuid';

type Store = Map<UUID, ClientTabsState>;

const store: Store = new Map();

function getNow(): number { return Date.now(); }

export function getClientTabsState(clientId: UUID): ClientTabsState | null {
  const state = store.get(clientId) || null;
  return state ? { clientId: state.clientId, openTabs: [...state.openTabs], lastActiveId: state.lastActiveId } : null;
}

export function createQuery(clientId: UUID, name?: string, initialSql?: string): { queryId: UUID } {
  const id: UUID = (globalThis.crypto || require('crypto').webcrypto).randomUUID();
  const now = getNow();
  // Do not automatically open here; caller decides via openQuery
  const existing = store.get(clientId);
  if (!existing) {
    store.set(clientId, { clientId, openTabs: [], lastActiveId: id });
  }
  // Optionally seed content on first save; not used yet
  return { queryId: id };
}

export function openQuery(clientId: UUID, queryId: UUID, name?: string): void {
  if (!isUuidV4(clientId) || !isUuidV4(queryId)) return;
  const now = getNow();
  const state = store.get(clientId) || { clientId, openTabs: [], lastActiveId: queryId };
  if (!state.openTabs.find(t => t.id === queryId)) {
    const tab: QueryTab = { id: queryId, name: name || 'Untitled', sql: '', createdAt: now, updatedAt: now };
    state.openTabs.push(tab);
  }
  store.set(clientId, state);
}

export function closeQuery(clientId: UUID, queryId: UUID): void {
  if (!isUuidV4(clientId) || !isUuidV4(queryId)) return;
  const state = store.get(clientId);
  if (!state) return;
  state.openTabs = state.openTabs.filter(t => t.id !== queryId);
  if (state.lastActiveId === queryId) {
    state.lastActiveId = state.openTabs[0]?.id || (globalThis.crypto || require('crypto').webcrypto).randomUUID();
  }
  store.set(clientId, state);
}

export function activateQuery(clientId: UUID, queryId: UUID): void {
  if (!isUuidV4(clientId) || !isUuidV4(queryId)) return;
  const state = store.get(clientId) || { clientId, openTabs: [], lastActiveId: queryId };
  state.lastActiveId = queryId;
  store.set(clientId, state);
}

export function saveQuery(clientId: UUID, queryId: UUID, name: string, sql: string): void {
  if (!isUuidV4(clientId) || !isUuidV4(queryId)) return;
  const state = store.get(clientId);
  if (!state) return;
  const tab = state.openTabs.find(t => t.id === queryId);
  if (!tab) return;
  tab.name = name || tab.name;
  tab.sql = sql;
  tab.updatedAt = getNow();
  store.set(clientId, state);
}
