'use server';

import type { ReactNode } from 'react';

import { ClientRouteProvider }  from './_providers/ClientRouteProvider';
import { SQLValidatorProvider } from './_providers/SQLValidatorProvider';
import Titlebar                 from '@Components/layout/Titlebar';
import PanelLayout              from '@Components/layout/PanelLayout';
import ChatPanel                from './_components/ChatPanel';
import DirectoryPanel           from './_components/DirectoryPanel';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string; queryId: string }> }) {
  const { clientId, queryId } = await params;
  return (
    <ClientRouteProvider clientId={clientId} queryId={queryId}>
      <SQLValidatorProvider>
        <Titlebar />
        <PanelLayout
          left={<ChatPanel collapsed={false} side="left" />}
          right={<DirectoryPanel collapsed={false} side="right" />}
        >
          {children}
        </PanelLayout>
      </SQLValidatorProvider>
    </ClientRouteProvider>
  );
}


export default Layout;
