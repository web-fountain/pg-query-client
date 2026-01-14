'use client';

import type { DataSourceMeta }                from '@Redux/records/dataSource/types';
import type { UUIDv7 }                        from '@Types/primitives';

import {
  Fragment, useCallback, useTransition
}                                             from 'react';
import { useParams, useRouter }               from 'next/navigation';

import { useDataSourceUI }                    from '@OpSpaceProviders/DataSourceProvider';
import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import { selectDataSourceList }               from '@Redux/records/dataSource';
import { createNewUnsavedDataQueryThunk }     from '@Redux/records/dataQuery/thunks';
import { selectNextUntitledName }             from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                     from '@Utils/generateId';

import opspaceStyles                          from '../../../styles.module.css';
import styles                                 from './styles.module.css';


function formatDataSourceKind(kind: DataSourceMeta['kind']): string {
  return kind === 'pglite' ? 'PGlite' : 'Postgres';
}

function OpSpaceIntro() {
  const { opspaceId }                 = useParams<{ opspaceId: string }>()!;
  const router                        = useRouter();
  const dispatch                      = useReduxDispatch();
  const { openConnectServerModal }    = useDataSourceUI();

  const dataSourceList                = useReduxSelector(selectDataSourceList);
  const nextUntitledName              = useReduxSelector(selectNextUntitledName);
  const [isPending, startTransition]  = useTransition();

  const handleOpenConnect = useCallback(() => {
    openConnectServerModal();
  }, [openConnectServerModal]);

  const handleCreateForConnection = useCallback((dataSourceCredentialId: UUIDv7) => {
    if (isPending) return;

    startTransition(() => {
      const dataQueryId = generateUUIDv7();
      dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName, dataSourceCredentialId }));
      router.replace(`/opspace/${opspaceId}/queries/new`);
    });
  }, [dispatch, isPending, nextUntitledName, opspaceId, router, startTransition]);

  return (
    <div className={opspaceStyles['center-page']}>
      <div className={styles['intro']}>
        <img
          className={styles['logo']}
          src="/postgres_logo.svg"
          alt="PostgreSQL logo (SVG)"
        />
        <div className={styles['header']}>
          <div className={styles['headline']}>Choose a data source</div>
          <div className={styles['subhead']}>
            Choose a saved data source or connect a new one to start querying.
          </div>
        </div>

        <div className={styles['data-source-list']}>
          {dataSourceList.length === 0
            ? (
                <div className={styles['empty']}>
                  <div className={styles['empty-title']}>No data sources yet</div>
                  <div className={styles['empty-subhead']}>
                    Connect a data source to create and run queries in this workspace.
                  </div>
                </div>
              )
            : (
                <ul className={styles['list']} aria-label="Data sources">
                  {dataSourceList.map((ds) => {
                    const title = `${formatDataSourceKind(ds.kind)} · ${ds.name}`;
                    return (
                      <li
                        key={ds.dataSourceId}
                        className={styles['item']}
                      >
                        <div className={styles['item-main']}>
                          <div className={styles['item-title']}>
                            <span className={styles['item-name']}>{title}</span>
                          </div>
                          <div className={styles['item-meta']}>
                            {/* AIDEV-NOTE: Show IndexDB connections as 'idx://' instead of 'pglite://' in list for clarity */}
                            <span>
                              {ds.label?.replace(/^pglite:\/\//, 'idx://pgqc_')}
                            </span>
                          </div>
                        </div>

                        <div className={styles['item-actions']}>
                          <button
                            type="button"
                            className={styles['create-button']}
                            onClick={() => handleCreateForConnection(ds.dataSourceCredentialId)}
                            disabled={isPending}
                            aria-busy={isPending}
                          >
                            {isPending ? 'Opening…' : 'Create New Query'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            }
        </div>

        <div className={styles['cta']}>
          <button
            type="button"
            className={styles['connect-button']}
            onClick={handleOpenConnect}
          >
            Connect a server
          </button>
        </div>
      </div>
    </div>
  );
}


export default OpSpaceIntro;
