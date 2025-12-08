import type { UUIDv7 } from '@Types/primitives';


type Tab = {
  groupId   : number;
  tabId     : UUIDv7;
  mountId   : UUIDv7;
  position  : number;
};

type Tabbar = {
  tabIds          : UUIDv7[];
  activeTabId     : UUIDv7 | null;
  focusedTabIndex : number | null;
  entities        : Record<UUIDv7, Tab>;
  lastActiveUnsavedTabId : UUIDv7 | null;
};


export type { Tab, Tabbar };
