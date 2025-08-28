'use server';

import type { ReactNode }     from 'react';
import { SQLRunnerProvider }  from './_providers/SQLRunnerProvider';
import { ChatProvider }       from './_providers/ChatProvider';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return (
    <SQLRunnerProvider clientId={clientId}>
      <ChatProvider>
        {children}
      </ChatProvider>
    </SQLRunnerProvider>
  );
}


export default Layout;
