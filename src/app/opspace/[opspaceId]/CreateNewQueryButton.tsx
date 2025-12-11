'use client';

import { useCallback, useTransition } from 'react';
import { useParams, useRouter }       from 'next/navigation';

import styles                         from '../styles.module.css';


function CreateNewQueryButton() {
  const { opspaceId }                 = useParams<{ opspaceId: string }>()!;
  const [isPending, startTransition]  = useTransition();
  const router                        = useRouter();

  // AIDEV-NOTE: Navigate to /queries/new; QueryWorkspace is responsible for
  // creating the initial unsaved tab when there are no open tabs yet.
  const handleCreateNewQuery = useCallback(() => {
    if (isPending) return;

    startTransition(() => {
      try {
        const key = `pg-query-client/opspace/${opspaceId}/new-intent`;
        window.sessionStorage.setItem(key, '1');
      } catch {}
      router.replace(`/opspace/${opspaceId}/queries/new`);
    });
  }, [isPending, opspaceId, router]);

  return (
    <button
      type="button"
      className={styles['instructions-button']}
      onClick={handleCreateNewQuery}
      disabled={isPending}
      aria-busy={isPending}
      aria-disabled={isPending}
    >
      {isPending ? 'Opening…' : 'Create New Query'}
    </button>
  );
}


export default CreateNewQueryButton;
