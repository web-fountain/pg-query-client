import type { ClientTabsState, QueryWorkspaceProps } from '@Types/workspace';

import { notFound }   from 'next/navigation';
import { isUuidV4 }   from '@Utils/uuid';
import {
  getClientTabsState,
  openQuery     as saOpen,
  activateQuery as saActivate
}                     from './_actions/queries';

import QueryWorkspace from './_components/QueryWorkspace';


async function Page({ params }: { params: Promise<{ clientId: string; queryId: string }> }) {
  const { clientId, queryId } = await params;

  // AIDEV-NOTE: Guard against devtools source map and other invalid path segments creating tabs
  if (!isUuidV4(clientId) || !isUuidV4(queryId)) return notFound();

  // Ensure the requested query is recorded as open/active before rendering
  try {
    await saOpen({ clientId, queryId });
    await saActivate({ clientId, queryId });
  } catch {}

  let serverState: ClientTabsState | null = await getClientTabsState(clientId);
  if (!serverState) {
    // Seed state with the requested query if missing
    serverState = {
      clientId,
      openTabs: [
        { id: queryId, name: 'Untitled', sql: '', createdAt: Date.now(), updatedAt: Date.now() }
      ],
      lastActiveId: queryId
    } as ClientTabsState;
  }

  const props: QueryWorkspaceProps = {
    clientId,
    initialTabs: serverState.openTabs,
    initialActiveId: serverState.lastActiveId
  };

  return <QueryWorkspace {...props} />;
}


export default Page;
