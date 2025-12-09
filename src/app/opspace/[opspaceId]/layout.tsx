'use server';

import type { ReactNode }     from 'react';
import type { UUIDv7 }        from '@Types/primitives';
import type { RootState }     from '@Redux/store';
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
import { listOpenTabs }       from './queries/_actions/tabs';


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
  const [queries, tabs] = await Promise.all([
    listDataQueries(),
    listOpenTabs()
  ]);

  const preloadedState: Partial<RootState> = {
    dataQueryRecords: queries?.data?.reduce((acc, query) => {
      acc[query.dataQueryId as UUIDv7] = {
        current: query,
        persisted: query,
        unsaved: {},
        isUnsaved: false,
        isInvalid: false
      } as DataQueryRecordItem;

      return acc;
    }, {} as DataQueryRecord) ?? {},
    ...(tabs.success && tabs.data ? { tabs: tabs.data } : {})
  };

  return (
    <StoreProvider preloadedState={preloadedState}>
      <SQLRunnerProvider>
        <ChatProvider>
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
