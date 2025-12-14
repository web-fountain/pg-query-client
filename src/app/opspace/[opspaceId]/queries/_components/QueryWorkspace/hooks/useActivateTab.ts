'use client';

import type { UUIDv7 }        from '@Types/primitives';

import { useEffectEvent }     from 'react';
import { useReduxDispatch }   from '@Redux/storeHooks';
import { setActiveTabThunk }  from '@Redux/records/tabbar/thunks';
import { logClientJson }      from '@Observability/client';
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
        logClientJson('error', () => ({
          event : 'tab.activate',
          phase : 'missing-mount-id',
          tabId : tabId
        }));
        return;
      }
      navigateToSaved(result.mountId);
    }
  });

  return activateTab;
}


export { useActivateTab };
