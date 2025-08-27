'use server';

import type { UUID, NewQueryInput, QueryLifecycleInput, SaveQueryInput, ClientTabsState } from '@Types/workspace';
import * as Tabs from './MockTabsService';


export async function createNewQuery(input: NewQueryInput): Promise<{ queryId: UUID }> {
  const { clientId, name, initialSql, queryId } = input;
  if (queryId) return { queryId } as { queryId: UUID };
  return Tabs.createQuery(clientId, name, initialSql);
}

export async function openQuery(_input: QueryLifecycleInput): Promise<void> {
  const { clientId, queryId, name } = _input;
  Tabs.openQuery(clientId, queryId, name);
}

export async function closeQuery(_input: QueryLifecycleInput): Promise<void> {
  const { clientId, queryId } = _input;
  Tabs.closeQuery(clientId, queryId);
}

export async function activateQuery(_input: QueryLifecycleInput): Promise<void> {
  const { clientId, queryId } = _input;
  Tabs.activateQuery(clientId, queryId);
}

export async function saveQueryContent(_input: SaveQueryInput): Promise<void> {
  const { clientId, queryId, name, sql } = _input;
  Tabs.saveQuery(clientId, queryId, name, sql);
}

export async function getClientTabsState(_clientId: UUID): Promise<ClientTabsState | null> {
  return Tabs.getClientTabsState(_clientId);
}
