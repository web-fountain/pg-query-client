'use client';

import type { TabbarRecord }  from '@Redux/records/tabbar/types';

import { useEffect, useRef }  from 'react';
import { useReduxDispatch }   from '@Redux/storeHooks';
import { setInitialTabs }     from '@Redux/records/tabbar';


function TabsStoreInitializer({ initialTabs }: { initialTabs: TabbarRecord }) {
  const dispatch    = useReduxDispatch();
  const initialized = useRef(false);

  // AIDEV-NOTE: Dispatch inside useEffect to avoid render-phase side effects
  useEffect(() => {
    if (!initialized.current) {
      dispatch(setInitialTabs(initialTabs));
      initialized.current = true;
    }
  }, [dispatch, initialTabs]);

  return null;
}


export default TabsStoreInitializer;
