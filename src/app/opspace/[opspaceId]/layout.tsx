import type { ReactNode }           from 'react';
import type { RootState }           from '@Redux/store';
import type { Base64Url22 }         from '@Types/primitives';

import { Suspense }                 from 'react';
import { connection }               from 'next/server';

import StoreProvider                from '@Redux/StoreProvider';
import { ChatProvider }             from '@OpSpaceProviders/ChatProvider';
import { SQLRunnerProvider }        from '@OpSpaceProviders/SQLRunnerProvider';
import { QueriesRouteProvider }     from './queries/_providers/QueriesRouteProvider';

import OpSpaceShellSkeleton         from '@Components/layout/OpSpaceShellSkeleton';
import Titlebar                     from '@Components/layout/Titlebar';
import PanelLayout                  from '@Components/layout/PanelLayout';
import LeftPanel                    from '@Components/layout/PanelLayout/LeftPanel';
import MainPanel                    from '@Components/layout/PanelLayout/MainPanel';
import RightPanel                   from '@Components/layout/PanelLayout/RightPanel';
import BootstrapError               from '@Components/layout/BootstrapError';

import ChatPanel                    from '@Components/ChatPanel';
import DirectoryPanel               from '@Components/DirectoryPanel';

import OpSpacePreloadClient         from './_components/OpSpacePreloadClient';
import { bootstrapWorkspaceAction } from './queries/_actions/bootstrap';


type LayoutParams = Promise<{ opspaceId: string }>;
function Layout({ children, params }: { children: ReactNode, params: LayoutParams }) {
  return (
    <Suspense fallback={<OpSpaceShellSkeleton />}>
      <LayoutWithData params={params}>
        {children}
      </LayoutWithData>
    </Suspense>
  );
}

async function LayoutWithData({ children, params }: { children: ReactNode, params: LayoutParams }) {
  // AIDEV-NOTE: Opt into dynamic rendering - this component requires request headers
  await connection();

  const { opspaceId } = await params;
  const bootstrap     = await bootstrapWorkspaceAction();

  if (!bootstrap.success) {
    return <BootstrapError requestId={bootstrap.error.id} />;
  }

  const preloadedState: Partial<RootState> = {
    dataQueryRecords  : bootstrap.data.dataQueryRecords,
    tabs              : bootstrap.data.tabs,
    queryTree         : bootstrap.data.queryTree,
    unsavedQueryTree  : bootstrap.data.unsavedQueryTree
  };

  return (
    <StoreProvider key={opspaceId} preloadedState={preloadedState}>
      <QueriesRouteProvider opspaceId={opspaceId as Base64Url22}>
        <SQLRunnerProvider>
          <ChatProvider>
            <OpSpacePreloadClient />
            <Titlebar />

            <PanelLayout>
              <LeftPanel>
                <ChatPanel side="left" />
              </LeftPanel>

              <MainPanel>
                <Suspense>
                  {children}
                </Suspense>
              </MainPanel>

              <RightPanel>
                <DirectoryPanel side="right" />
              </RightPanel>
            </PanelLayout>

          </ChatProvider>
        </SQLRunnerProvider>
      </QueriesRouteProvider>
    </StoreProvider>
  );
}


export default Layout;
