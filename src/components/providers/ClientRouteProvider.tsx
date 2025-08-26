'use client';

import type { ReactNode }             from 'react';
import type { UUID }                  from '@Types/workspace';
import { createContext, useContext }  from 'react';


type ClientRoute = { clientId: UUID; queryId: UUID };

const ClientRouteCtx = createContext<ClientRoute | null>(null);

function ClientRouteProvider({ clientId, queryId, children }: ClientRoute & { children: ReactNode }) {
  return (
    <ClientRouteCtx.Provider value={{ clientId, queryId }}>
      {children}
    </ClientRouteCtx.Provider>
  );
}

function useClientRoute(): ClientRoute {
  const ctx = useContext(ClientRouteCtx);
  if (!ctx) throw new Error('useClientRoute must be used within ClientRouteProvider');
  return ctx;
}


export { ClientRouteProvider, useClientRoute };
