'use client';

import type { UnsavedQueryTreeRecord }  from '@Redux/records/unsavedQueryTree/types';

import { useLayoutEffect }              from 'react';
import { useReduxDispatch }             from '@Redux/storeHooks';
import { setInitialUnsavedQueryTree }   from '@Redux/records/unsavedQueryTree';


function HydrateUnsavedTree({ data }: { data: { success: boolean; data?: UnsavedQueryTreeRecord } }) {
  const dispatch = useReduxDispatch();

  useLayoutEffect(() => {
    if (data.success && data.data) {
      dispatch(setInitialUnsavedQueryTree(data.data));
    }
  }, [dispatch, data]);

  return null;
}


export default HydrateUnsavedTree;
