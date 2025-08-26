'use server';

import type { ReactNode } from 'react';

import { ClientRouteProvider }  from '@Components/providers/ClientRouteProvider';
import Titlebar                 from '@Components/layout/Titlebar';
import { SQLValidatorProvider } from '@Components/providers/SQLValidatorProvider';
import { SQLRunnerProvider }    from '@Components/providers/SQLRunnerProvider';
import PanelLayout              from '@Components/layout/PanelLayout';
import ChatPanel                from '@Components/panels/ChatPanel';
import DirectoryPanel           from '@Components/panels/DirectoryPanel';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string; queryId: string }> }) {
  const { clientId, queryId } = await params;
  return (
    <ClientRouteProvider clientId={clientId} queryId={queryId}>
      <SQLValidatorProvider>
        <SQLRunnerProvider clientId={clientId}>
          <Titlebar />
          <PanelLayout
            left={<ChatPanel collapsed={false} side="left" />}
            right={<DirectoryPanel collapsed={false} side="right" />}
          >
            {children}
          </PanelLayout>
        </SQLRunnerProvider>
      </SQLValidatorProvider>
    </ClientRouteProvider>
  );
}


export default Layout;
