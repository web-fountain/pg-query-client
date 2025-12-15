'use client';

import type { UUIDv7 }        from '@Types/primitives';

import { useEffectEvent, useRef } from 'react';
import { useReduxDispatch }   from '@Redux/storeHooks';
import { setActiveTabThunk }  from '@Redux/records/tabbar/thunks';
import { logClientJson }      from '@Observability/client';
import { useQueriesRoute }    from '@QueriesProvider/QueriesRouteProvider';


function useActivateTab() {
  const { navigateToNew, navigateToSaved }  = useQueriesRoute();
  const activationSeqRef                    = useRef<number>(0);
  const dispatch                            = useReduxDispatch();

  const activateTab = useEffectEvent(async (tabId: UUIDv7) => {
    activationSeqRef.current += 1;
    const seq = activationSeqRef.current;

    let result;
    try {
      result = await dispatch(setActiveTabThunk(tabId)).unwrap();
    } catch (error) {
      logClientJson('error', () => ({
        event         : 'tab.activate',
        phase         : 'set-active-tab-thunk-failed',
        tabId         : tabId,
        errorMessage  : error instanceof Error ? error.message : String(error)
      }));
      return;
    }

    // AIDEV-NOTE: If the user clicked another tab while this activation was in-flight,
    // ignore the stale result so navigation follows the most recent user intent.
    if (seq !== activationSeqRef.current) return;

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
