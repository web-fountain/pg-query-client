'use client';

import type { UUIDv7 }        from '@Types/primitives';

import { useEffectEvent }     from 'react';
import { useReduxDispatch }   from '@Redux/storeHooks';
import { setActiveTabThunk }  from '@Redux/records/tabbar/thunks';

import { useQueriesRoute }    from '@QueriesProvider/QueriesRouteProvider';


function useActivateTab() {
  const dispatch = useReduxDispatch();
  const { navigateToNew, navigateToSaved } = useQueriesRoute();

  const activateTab = useEffectEvent(async (tabId: UUIDv7) => {
    const result = await dispatch(setActiveTabThunk(tabId)).unwrap();

    if (result.isUnsaved) {
      navigateToNew();
    } else {
      if (!result.mountId) {
        console.error('[useActivateTab] Missing mountId for saved tab activation.', { tabId });
        return;
      }
      navigateToSaved(result.mountId);
    }
  });

  return activateTab;
}


export { useActivateTab };
