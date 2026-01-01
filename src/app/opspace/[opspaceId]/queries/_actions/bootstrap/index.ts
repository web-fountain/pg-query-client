'use server';

import type { UUIDv7 }                            from '@Types/primitives';
import type { DataQuery, DataQueryRecord }        from '@Redux/records/dataQuery/types';
import type { DataSourceMeta, DataSourceRecord }  from '@Redux/records/dataSource/types';
import type { TabbarRecord }                      from '@Redux/records/tabbar/types';
import type { QueryTreeRecord }                   from '@Redux/records/queryTree/types';
import type { UnsavedQueryTreeRecord }            from '@Redux/records/unsavedQueryTree/types';
import type { ActionError }                       from '@Errors/types';
import type { ActionResult }                      from '../types';
import type { WorkspaceBootstrap }                from './types';

import { ERROR_CODES }                            from '@Errors/codes';
import { withAction }                             from '@Observability/server/action';
import { aggregateActionError, fail, ok }         from '@Errors/server/actionResult.server';
import { listDataQueriesAction }                  from '../queries';
import {
  buildInitialQueryTreeAction,
  buildInitialUnsavedQueryTreeAction
}                                                 from '../queryTree';
import { listOpenTabsAction }                     from '../tabs';
import {
  getActiveDataSourceAction,
  listDataSourcesAction
}                                                 from '@OpSpaceDataSourceActions';


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
        dataSourcesResult,
        activeDataSourceResult
      ] = await Promise.all([
        listOpenTabsAction(),
        listDataQueriesAction(),
        buildInitialQueryTreeAction(),
        buildInitialUnsavedQueryTreeAction(),
        listDataSourcesAction(),
        getActiveDataSourceAction()
      ]);

      if (!tabsResult.success || !queryTreeResult.success || !unsavedTreeResult.success || !queriesResult.success) {
        const causes: ActionError[] = [];
        if (!tabsResult.success)        causes.push(tabsResult.error);
        if (!queriesResult.success)     causes.push(queriesResult.error);
        if (!queryTreeResult.success)   causes.push(queryTreeResult.error);
        if (!unsavedTreeResult.success) causes.push(unsavedTreeResult.error);

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

      const tabs             = tabsResult.data        as TabbarRecord;
      const queryTree        = queryTreeResult.data   as unknown as QueryTreeRecord;
      const unsavedQueryTree = unsavedTreeResult.data as unknown as UnsavedQueryTreeRecord;
      const queries          = queriesResult.data     as DataQuery[] | undefined;

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

      // AIDEV-NOTE: DbConnections bootstrap is non-fatal; if the backend does not yet support
      // connections endpoints, we still want the OpSpace shell to render so the user can
      // attempt to create a connection (or see a helpful error in the modal).
      const dataSources: DataSourceMeta[] =
        dataSourcesResult.success && Array.isArray(dataSourcesResult.data)
          ? (dataSourcesResult.data as DataSourceMeta[])
          : [];

      const activeDataSourceId =
        activeDataSourceResult.success
          ? (activeDataSourceResult.data?.dataSourceId ?? null)
          : null;

      const dataSourceRecords: DataSourceRecord = {
        dataSourceIds      : dataSources.map((ds) => ds.dataSourceId),
        byId               : Object.fromEntries(dataSources.map((ds) => [ds.dataSourceId, ds])),
        activeDataSourceId : activeDataSourceId
      };

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
