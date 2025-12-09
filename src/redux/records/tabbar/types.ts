import type { Tab, Tabbar } from '@Types/tabs';


// AIDEV-NOTE: TabbarRecord mirrors backend Tabbar; initial state is provided
// by SSR preloadedState (listOpenTabs) or by the reducer defaults.
type TabbarRecord = Tabbar;


export type { Tab, TabbarRecord };
