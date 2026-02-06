'use server';

import type { UUIDv7 }                            from '@Types/primitives';
import type { DataQuery, DataQueryRecord }        from '@Redux/records/dataQuery/types';
import type { DataSourceRecord }                  from '@Redux/records/dataSource/types';
import type { TabbarRecord }                      from '@Redux/records/tabbar/types';
import type { QueryTreeRecord }                   from '@Redux/records/queryTree/types';
import type { UnsavedQueryTreeRecord }            from '@Redux/records/unsavedQueryTree/types';
import type { ActionError }                       from '@Errors/types';
import type { ActionResult }                      from '../types';
import type { WorkspaceBootstrap }                from './types';

import { listDataSourcesAction }                  from '@OpSpaceDataSourceActions';
import { withAction }                             from '@Observability/server/action';
import { ERROR_CODES }                            from '@Errors/codes';
import { aggregateActionError, fail, ok }         from '@Errors/server/actionResult.server';

import { listDataQueriesAction }                  from '../queries';
import {
  buildInitialQueryTreeAction,
  buildInitialUnsavedQueryTreeAction
}                                                 from '../queryTree';
import { listOpenTabsAction }                     from '../tabs';


async function bootstrapWorkspaceAction(): Promise<ActionResult<WorkspaceBootstrap>> {
  // AIDEV-NOTE: Phase 1 bootstrap aggregator. This function centralizes the
  // existing server actions used to hydrate the opspace workspace on first
  // render. It does not alter routing behavior or create new unsaved queries;
  // later phases will layer those behaviors on top.
  return withAction(
    { action: 'bootstrap.workspace', op: 'read' },
    async ({ meta }) => {
      const [
        tabsResult,
        queriesResult,
        queryTreeResult,
        unsavedTreeResult,
        dataSourcesResult
      ] = await Promise.all([
        listOpenTabsAction(),
        listDataQueriesAction(),
        buildInitialQueryTreeAction(),
        buildInitialUnsavedQueryTreeAction(),
        listDataSourcesAction()
      ]);

      if (!tabsResult.success || !queryTreeResult.success || !unsavedTreeResult.success || !queriesResult.success || !dataSourcesResult.success) {
        const causes: ActionError[] = [];
        if (!tabsResult.success)        causes.push(tabsResult.error);
        if (!queriesResult.success)     causes.push(queriesResult.error);
        if (!queryTreeResult.success)   causes.push(queryTreeResult.error);
        if (!unsavedTreeResult.success) causes.push(unsavedTreeResult.error);
        if (!dataSourcesResult.success) causes.push(dataSourcesResult.error);

        const primaryCode =
          causes.find(c => c.code === ERROR_CODES.context.missingContext)?.code ||
          causes.find(c => c.code === ERROR_CODES.auth.unauthenticated)?.code ||
          causes.find(c => c.code === ERROR_CODES.auth.forbidden)?.code ||
          ERROR_CODES.backend.failed;

        return fail(meta, aggregateActionError(meta, {
          code    : primaryCode,
          message : 'Failed to load workspace.',
          causes  : causes
        }));
      }

      const tabs              = tabsResult.data        as TabbarRecord;
      const queryTree         = queryTreeResult.data   as unknown as QueryTreeRecord;
      const unsavedQueryTree  = unsavedTreeResult.data as unknown as UnsavedQueryTreeRecord;
      const queries           = queriesResult.data     as DataQuery[] | undefined;
      const dataSourceRecords = dataSourcesResult.data as DataSourceRecord;

      // AIDEV-NOTE: Backend listDataQueries now returns only DataQueries for
      // open tabs (saved + unsaved). Build the DataQueryRecord directly from
      // this filtered list so Redux has per-id records for all open tabs.
      const dataQueryRecords: DataQueryRecord = {};
      if (queries && queries.length > 0) {
        for (const query of queries) {
          const dataQueryId = query.dataQueryId as UUIDv7 | undefined;
          if (!dataQueryId) continue;

          dataQueryRecords[dataQueryId] = {
            current   : query,
            persisted : query,
            unsaved   : {},
            isUnsaved : false,
            isInvalid : false,
            invalid   : {}
          };
        }
      }

      return ok(meta, {
        tabs,
        dataQueryRecords,
        queryTree,
        unsavedQueryTree,
        dataSourceRecords
      });
    }
  );
}


export { bootstrapWorkspaceAction };
