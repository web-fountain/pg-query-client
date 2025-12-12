import type { DataQueryRecord }         from '@Redux/records/dataQuery/types';
import type { TabbarRecord }            from '@Redux/records/tabbar/types';
import type { QueryTreeRecord }         from '@Redux/records/queryTree/types';
import type { UnsavedQueryTreeRecord }  from '@Redux/records/unsavedQueryTree/types';


export type WorkspaceBootstrap = {
  tabs: TabbarRecord;
  dataQueryRecords: DataQueryRecord;
  queryTree: QueryTreeRecord;
  unsavedQueryTree: UnsavedQueryTreeRecord;
};
