'use client';

import type { UUIDv7 }                        from '@Types/primitives';

import { useCallback, useTransition }         from 'react';
import { useParams, useRouter }               from 'next/navigation';

import { useDataSourceUI }                    from '@OpSpaceProviders/DataSourceProvider';
import { setActiveDataSourceAction }          from '@OpSpaceDataSourceActions';
import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import {
  selectActiveDataSourceId,
  selectDataSourceList,
  setActiveDataSourceId
}                                             from '@Redux/records/dataSource';
import { createNewUnsavedDataQueryThunk }     from '@Redux/records/dataQuery/thunks';
import { selectNextUntitledName }             from '@Redux/records/unsavedQueryTree';
import { generateUUIDv7 }                     from '@Utils/generateId';

import opspaceStyles                          from '../../../styles.module.css';
import styles                                 from './styles.module.css';


function OpSpaceIntro() {
  const { opspaceId }                 = useParams<{ opspaceId: string }>()!;
  const router                        = useRouter();
  const dispatch                      = useReduxDispatch();
  const { openConnectServerModal }    = useDataSourceUI();

  const dataSourceList                = useReduxSelector(selectDataSourceList);
  const activeDataSourceId            = useReduxSelector(selectActiveDataSourceId);
  const nextUntitledName              = useReduxSelector(selectNextUntitledName);
  const [isPending, startTransition]  = useTransition();

  const handleOpenConnect = useCallback(() => {
    openConnectServerModal();
  }, [openConnectServerModal]);

  const handleCreateForConnection = useCallback((dataSourceId: UUIDv7) => {
    if (isPending) return;

    startTransition(() => {
      // AIDEV-NOTE: Selecting a connection implicitly sets it active for the workspace.
      dispatch(setActiveDataSourceId({ dataSourceId }));
      void setActiveDataSourceAction(dataSourceId).catch(() => {});

      const dataQueryId = generateUUIDv7();
      dispatch(createNewUnsavedDataQueryThunk({ dataQueryId, name: nextUntitledName }));
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
          <div className={styles['headline']}>Connect a server</div>
          <div className={styles['subhead']}>
            Choose a saved connection or connect a new Postgres server to start querying.
          </div>
        </div>

        <div className={styles['data-source-list']}>
          {dataSourceList.length === 0 ? (
            <div className={styles['empty']}>
              <div className={styles['empty-title']}>No connections yet</div>
              <div className={styles['empty-subhead']}>
                Connect a server to create and run queries in this workspace.
              </div>
            </div>
          ) : (
            <ul className={styles['list']} aria-label="Data sources">
              {dataSourceList.map((ds) => {
                const isActive = ds.dataSourceId === activeDataSourceId;
                return (
                  <li
                    key={ds.dataSourceId}
                    className={styles['item']}
                    data-active={isActive ? 'true' : undefined}
                  >
                    <div className={styles['item-main']}>
                      <div className={styles['item-title']}>
                        <span className={styles['item-name']}>{ds.serverGroupName}</span>
                        {isActive && (
                          <span className={styles['badge']} aria-label="Active connection">Active</span>
                        )}
                      </div>
                      <div className={styles['item-meta']}>
                        <span>{ds.username}@{ds.host}:{ds.port}</span>
                        <span className={styles['dot']} aria-hidden="true">•</span>
                        <span>{ds.database}</span>
                        <span className={styles['dot']} aria-hidden="true">•</span>
                        <span>TLS: {ds.sslMode}</span>
                      </div>
                    </div>

                    <div className={styles['item-actions']}>
                      <button
                        type="button"
                        className={styles['create-button']}
                        onClick={() => handleCreateForConnection(ds.dataSourceId)}
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
          )}
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
