'use server';

import type { ReactNode }     from 'react';
import type { UUIDv7 }        from '@Types/primitives';
import type {
  DataQueryRecord,
  DataQueryRecordItem
}                             from '@Redux/records/dataQuery/types';

import { Suspense }           from 'react';

import StoreProvider          from '@Redux/StoreProvider';
import { ChatProvider }       from '@OpSpaceProviders/ChatProvider';
import { SQLRunnerProvider }  from '@OpSpaceProviders/SQLRunnerProvider';

import Titlebar               from '@Components/layout/Titlebar';
import PanelLayout            from '@Components/layout/PanelLayout';
import LeftPanel              from '@Components/layout/PanelLayout/LeftPanel';
import MainPanel              from '@Components/layout/PanelLayout/MainPanel';
import RightPanel             from '@Components/layout/PanelLayout/RightPanel';

import ChatPanelData          from '@Components/ChatPanel/ServerData';
import DirectoryPanelData     from '@Components/DirectoryPanel/ServerData';

import { listDataQueries }    from './queries/_actions/queries';
import  TabsPreloader         from './_components/TabsPreloader';


function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <LayoutWithData>
        {children}
      </LayoutWithData>
    </Suspense>
  );
}

async function LayoutWithData({ children }: { children: ReactNode }) {
  const data = await listDataQueries();

  const preloadedState = {
    dataQueryRecords: data?.data?.reduce((acc, query) => {
      acc[query.dataQueryId as UUIDv7] = {
        current: query,
        persisted: query,
        unsaved: {},
        isUnsaved: false,
        isInvalid: false
      } as DataQueryRecordItem;

      return acc;
    }, {} as DataQueryRecord) ?? {}
  };

  return (
    <StoreProvider preloadedState={preloadedState}>
      <SQLRunnerProvider>
        <ChatProvider>
          {/*
            AIDEV-NOTE: Non-blocking background fetch for tabs.
            Valid composition: Server Component (Layout) -> Client (StoreProvider) -> Server (Suspense/TabsPreloader)
          */}
          <Suspense fallback={null}>
            <TabsPreloader />
          </Suspense>

          <Titlebar />

          <PanelLayout>
            <LeftPanel>
              <ChatPanelData />
            </LeftPanel>

            <MainPanel>
              <Suspense>
                {children}
              </Suspense>
            </MainPanel>

            <RightPanel>
              <DirectoryPanelData />
            </RightPanel>
          </PanelLayout>

        </ChatProvider>
      </SQLRunnerProvider>
    </StoreProvider>
  );
}


export default Layout;
