'use client';

import { useCallback, useTransition }         from 'react';
import { useParams, useRouter }               from 'next/navigation';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import { createNewUnsavedDataQueryThunk }     from '@Redux/records/dataQuery/thunks';
import { selectNextUntitledName }             from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                     from '@Utils/generateId';

import styles                                 from '../../../styles.module.css';


function CreateNewQueryButton() {
  const { opspaceId }                        = useParams<{ opspaceId: string }>()!;
  const [isPending, startTransition]         = useTransition();
  const router                               = useRouter();
  const dispatch                             = useReduxDispatch();
  const nextUntitledName                     = useReduxSelector(selectNextUntitledName);

  // AIDEV-NOTE: Explicit entrypoint from the opspace root. We eagerly create a
  // new unsaved query (tab + tree node) and then navigate to /queries/new so
  // QueryWorkspace can display it, instead of relying on route-based auto-create.
  const handleCreateNewQuery = useCallback(() => {
    if (isPending) return;

    startTransition(() => {
      const dataQueryId = generateUUIDv7();
      dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));
      router.replace(`/opspace/${opspaceId}/queries/new`);
    });
  }, [dispatch, nextUntitledName, opspaceId, router, isPending, startTransition]);

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
