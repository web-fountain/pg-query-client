'use server';

import { listOpenTabs }       from '../queries/[dataQueryId]/_actions/tabs';
import TabsStoreInitializer   from './TabsStoreInitializer';


async function TabsPreloader() {
  const { success, data } = await listOpenTabs();

  console.log('[TabsPreloader] data', data);

  if (success && data) {
    return <TabsStoreInitializer initialTabs={data} />;
  }

  return null;
}


export default TabsPreloader;
