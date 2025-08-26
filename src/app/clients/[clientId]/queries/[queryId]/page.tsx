import type { ClientTabsState, QueryWorkspaceProps } from '@Types/workspace';
import { getClientTabsState, openQuery as saOpen, activateQuery as saActivate } from '@/app/_actions/queries';
import { notFound } from 'next/navigation';
import { isUuidV4 } from '@Utils/uuid';

import { redirect }   from 'next/navigation';
import QueryWorkspace from '@Components/QueryWorkspace';


const DEFAULT_CLIENT_ID = '964b7ade-5057-4ef5-8bb8-24358928229e';
const DEFAULT_QUERY_ID  = '4793e07f-7055-47d3-9a43-5255b6469a1d';

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

  const openIds = new Set(serverState.openTabs.map(t => t.id));
  // No further augmentation here; trust server state and local storage merge on client to avoid flicker

  const props: QueryWorkspaceProps = {
    clientId,
    initialTabs: serverState.openTabs,
    initialActiveId: serverState.lastActiveId
  };

  return <QueryWorkspace {...props} />;
}


export default Page;
