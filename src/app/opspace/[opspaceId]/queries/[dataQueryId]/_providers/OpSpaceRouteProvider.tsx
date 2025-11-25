'use client';

import type { ReactNode }             from 'react';
import type { Base64Url22, UUIDv7 }   from '@Types/primitives';
import { createContext, useContext }  from 'react';


type OpSpaceRoute = { opspaceId: Base64Url22; dataQueryId: UUIDv7 };

const OpSpaceRouteCtx = createContext<OpSpaceRoute | null>(null);

function OpSpaceRouteProvider({ opspaceId, dataQueryId, children }: OpSpaceRoute & { children: ReactNode }) {
  return (
    <OpSpaceRouteCtx.Provider value={{ opspaceId, dataQueryId }}>
      {children}
    </OpSpaceRouteCtx.Provider>
  );
}

function useOpSpaceRoute(): OpSpaceRoute {
  const ctx = useContext(OpSpaceRouteCtx);
  if (!ctx) throw new Error('useOpSpaceRoute must be used within OpSpaceRouteProvider');
  return ctx;
}


export { OpSpaceRouteProvider, useOpSpaceRoute };
