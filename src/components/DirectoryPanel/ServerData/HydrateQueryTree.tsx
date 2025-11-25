'use client';

import type { QueryTreeRecord } from '@Redux/records/queryTree/types';

import { useLayoutEffect }      from 'react';
import { useReduxDispatch }     from '@Redux/storeHooks';
import { setInitialQueryTree }  from '@Redux/records/queryTree';


function HydrateQueryTree({ data }: { data: { success: boolean; data?: QueryTreeRecord } }) {
  const dispatch = useReduxDispatch();

  useLayoutEffect(() => {
    if (data.success && data.data) {
      dispatch(setInitialQueryTree(data.data));
    }
  }, [dispatch, data]);

  return null;
}


export default HydrateQueryTree;
