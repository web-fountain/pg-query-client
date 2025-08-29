'use server';

import type { ReactNode }     from 'react';
import { SQLRunnerProvider }  from './_providers/SQLRunnerProvider';
import { ChatProvider }       from './_providers/ChatProvider';
import Titlebar               from '@Components/layout/Titlebar';
import PanelLayout            from '@Components/layout/PanelLayout';
import ChatPanel              from './[queryId]/_components/ChatPanel';
import DirectoryPanel         from './[queryId]/_components/DirectoryPanel';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return (
    <SQLRunnerProvider clientId={clientId}>
      <ChatProvider>
        <Titlebar />
        <PanelLayout
          left={<ChatPanel collapsed={false} side="left" />}
          right={<DirectoryPanel collapsed={false} side="right" />}
        >
          {children}
        </PanelLayout>
      </ChatProvider>
    </SQLRunnerProvider>
  );
}


export default Layout;
