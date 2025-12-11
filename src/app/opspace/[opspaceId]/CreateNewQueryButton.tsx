'use client';

import { useCallback, useTransition }         from 'react';
import { useParams, useRouter }               from 'next/navigation';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import { selectNextUntitledName }             from '@Redux/records/unsavedQueryTree';
import styles                                 from '../styles.module.css';


function CreateNewQueryButton() {
  const { opspaceId }                 = useParams<{ opspaceId: string }>()!;
  const [isPending, startTransition]  = useTransition();
  const nextUntitledName              = useReduxSelector(selectNextUntitledName);
  const dispatch                      = useReduxDispatch();
  const router                        = useRouter();

  // AIDEV-NOTE: Optimistic unsaved query + tab creation before navigating to
  // /queries/new. QueryWorkspace's bootstrap effect is guarded so it will not
  // create a duplicate unsaved tab when tabs/unsaved nodes already exist.
  const handleCreateNewQuery = useCallback(() => {
    if (isPending) return;

    startTransition(() => {
      router.replace(`/opspace/${opspaceId}/queries/new`);
    });
  }, [dispatch, isPending, opspaceId, router, nextUntitledName]);

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
