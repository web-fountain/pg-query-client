'use server';

import type { ReactNode }           from 'react';
import type { Base64Url22, UUIDv7 } from '@Types/primitives';

import { notFound }                 from 'next/navigation';
import QueryToolPanel               from '@Components/layout/QueryToolPanel';
import { isBase64Url22, isUUIDv7 }  from '@Utils/generateId';

import { OpSpaceRouteProvider }     from './_providers/OpSpaceRouteProvider';
import { SQLValidatorProvider }     from './_providers/SQLValidatorProvider';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ opspaceId: string; dataQueryId: string }> }) {
  const { opspaceId, dataQueryId } = await params;

  // AIDEV-NOTE: Validate route params at layout level to gate all children.
  if (!isBase64Url22(opspaceId) || !isUUIDv7(dataQueryId)) return notFound();

  return (
    <OpSpaceRouteProvider opspaceId={opspaceId as Base64Url22} dataQueryId={dataQueryId as UUIDv7}>
      <SQLValidatorProvider>
        <QueryToolPanel>
          {children}
        </QueryToolPanel>
      </SQLValidatorProvider>
    </OpSpaceRouteProvider>
  );
}


export default Layout;
