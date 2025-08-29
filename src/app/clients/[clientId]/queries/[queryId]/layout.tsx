'use server';

import type { ReactNode } from 'react';

import { ClientRouteProvider }  from './_providers/ClientRouteProvider';
import { SQLValidatorProvider } from './_providers/SQLValidatorProvider';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ clientId: string; queryId: string }> }) {
  const { clientId, queryId } = await params;
  return (
    <ClientRouteProvider clientId={clientId} queryId={queryId}>
      <SQLValidatorProvider>
        {children}
      </SQLValidatorProvider>
    </ClientRouteProvider>
  );
}


export default Layout;
