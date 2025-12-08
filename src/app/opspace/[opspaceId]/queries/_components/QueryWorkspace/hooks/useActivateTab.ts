'use client';

import type { UUIDv7 }        from '@Types/primitives';

import { useEffectEvent }     from 'react';

import { useReduxDispatch }   from '@Redux/storeHooks';
import { setActiveTabThunk }  from '@Redux/records/tabbar/thunks';

import { useOpSpaceRoute }    from '../../../_providers/OpSpaceRouteProvider';


type ActivateTabArgs = {
  tabId: UUIDv7;
  dataQueryId: UUIDv7;
};

function useActivateTab() {
  const dispatch = useReduxDispatch();
  const { navigateToNew, navigateToSaved } = useOpSpaceRoute();

  const activateTab = useEffectEvent(async ({ tabId, dataQueryId }: ActivateTabArgs) => {
    const isUnsaved = await dispatch(setActiveTabThunk(tabId)).unwrap();

    if (isUnsaved) {
      navigateToNew();
    } else {
      navigateToSaved(dataQueryId);
    }
  });

  return activateTab;
}


export { useActivateTab };
