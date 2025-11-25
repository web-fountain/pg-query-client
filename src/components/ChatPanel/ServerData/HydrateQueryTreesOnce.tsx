'use client';

import type { UnsavedQueryTreeRecord }  from '@Redux/records/unsavedQueryTree/types';
import type { QueryTreeRecord }         from '@Redux/records/queryTree/types';

import { useLayoutEffect, useState }    from 'react';

import { useReduxDispatch }             from '@Redux/storeHooks';
import { setInitialUnsavedQueryTree }   from '@Redux/records/unsavedQueryTree';
import { setInitialQueryTree }          from '@Redux/records/queryTree';


// AIDEV-NOTE: One-shot Redux hydration for the directory trees.
// Using useLayoutEffect minimizes visual flashes by committing before paint.
type Props = { queryTree: { success: boolean; data?: QueryTreeRecord }; unsavedTree: { success: boolean; data?: UnsavedQueryTreeRecord } };

function HydrateQueryTreesOnce({ queryTree, unsavedTree }: Props) {
  const dispatch = useReduxDispatch();

  // NOTE: if success is true, data is guaranteed to be present
  // TODO: when success if false, we want the client to refetch the tree data from the server
  useLayoutEffect(() => {
    if (!queryTree.success || !unsavedTree.success) return;

    try {
      dispatch(setInitialQueryTree({ ...queryTree.data! }));
      dispatch(setInitialUnsavedQueryTree({ ...unsavedTree.data! }));
    } catch {}
  }, [dispatch, queryTree, unsavedTree]);

  return null;
}


export default HydrateQueryTreesOnce;
