'use client';

import { useCallback, useTransition }         from 'react';
import { useParams, useRouter }               from 'next/navigation';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import { selectNextUntitledName }             from '@Redux/records/unsavedQueryTree';
import { createNewUnsavedDataQueryThunk }     from '@Redux/records/dataQuery/thunks';
import { generateUUIDv7 }                     from '@Utils/generateId';
import styles                                 from '../styles.module.css';


function CreateNewQueryButton() {
  const { opspaceId }                 = useParams<{ opspaceId: string }>()!;
  const [isPending, startTransition]  = useTransition();
  const nextUntitledName              = useReduxSelector(selectNextUntitledName);
  const dispatch                      = useReduxDispatch();
  const router                        = useRouter();

  // AIDEV-NOTE: Optimistic tab write + immediate navigation (in a transition); backend save happens via thunk. Guard double-clicks via isPending.
  const handleCreateNewQuery = useCallback(() => {
    if (isPending) return;

    const dataQueryId = generateUUIDv7();

    dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));

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
