import type { ReactNode }       from 'react';
import type { Base64Url22 }     from '@Types/primitives';

import { notFound }             from 'next/navigation';
import QueryToolPanel           from '@Components/layout/QueryToolPanel';
import { isBase64Url22 }        from '@Utils/generateId';

import { OpSpaceRouteProvider } from './_providers/OpSpaceRouteProvider';
import { SQLValidatorProvider } from './_providers/SQLValidatorProvider';


async function Layout({ children, params }: { children: ReactNode; params: Promise<{ opspaceId: string }> }) {
  const { opspaceId } = await params;

  console.log('[Layout]', opspaceId);

  // AIDEV-NOTE: Validate route params at layout level to gate all children.
  if (!isBase64Url22(opspaceId)) return notFound();

  return (
    <OpSpaceRouteProvider opspaceId={opspaceId as Base64Url22}>
      <SQLValidatorProvider>
        <QueryToolPanel>
          {children}
        </QueryToolPanel>
      </SQLValidatorProvider>
    </OpSpaceRouteProvider>
  );
}


export default Layout;
