'use server';

import type { ReactNode }     from 'react';
import { SQLRunnerProvider }  from './_providers/SQLRunnerProvider';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return (
    <SQLRunnerProvider clientId={clientId}>
      {children}
    </SQLRunnerProvider>
  );
}


export default Layout;
