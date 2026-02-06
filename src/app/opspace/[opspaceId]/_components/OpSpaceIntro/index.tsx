'use client';

import type { DataSourceMeta }                  from '@Redux/records/dataSource/types';
import type { UUIDv7 }                          from '@Types/primitives';

import { useCallback, useState, useTransition } from 'react';
import { useParams, useRouter }                 from 'next/navigation';

import { useDataSourceUI }                      from '@OpSpaceProviders/DataSourceProvider';
import { useReduxDispatch, useReduxSelector }   from '@Redux/storeHooks';
import { selectDataSourceList }                 from '@Redux/records/dataSource';
import { deleteDataSourceThunk }                from '@Redux/records/dataSource/thunks';
import { createNewUnsavedDataQueryThunk }       from '@Redux/records/dataQuery/thunks';
import { selectNextUntitledName }               from '@Redux/records/unsavedQueryTree';
import Icon                                     from '@Components/Icons';
import { generateUUIDv7 }                       from '@Utils/generateId';

import opspaceStyles                            from '../../../styles.module.css';
import styles                                   from './styles.module.css';


function formatDataSourceKind(kind: DataSourceMeta['kind']): string {
  return kind === 'pglite' ? 'PGlite' : 'Postgres';
}

function formatDataSourceLabel(label: string | null): string | null {
  if (!label) return null;
  // AIDEV-NOTE: Show IndexDB connections as 'idx://' instead of 'pglite://' in list for clarity
  return label.replace(/^pglite:\/\//, 'idx://pgqc_');
}

function OpSpaceIntro() {
  const { opspaceId }                                     = useParams<{ opspaceId: string }>()!;
  const router                                            = useRouter();
  const dispatch                                          = useReduxDispatch();
  const { openConnectDataSourceModal }                    = useDataSourceUI();

  const dataSourceList                                    = useReduxSelector(selectDataSourceList);
  const nextUntitledName                                  = useReduxSelector(selectNextUntitledName);
  const [isPending, startTransition]                      = useTransition();
  const [expandedDataSourceId, setExpandedDataSourceId]   = useState<UUIDv7 | null>(null);
  const [deletingDataSourceIds, setDeletingDataSourceIds] = useState<Set<UUIDv7>>(() => new Set<UUIDv7>());

  const handleOpenConnect = useCallback(() => {
    openConnectDataSourceModal();
  }, [openConnectDataSourceModal]);

  const handleToggleExpand = useCallback((dataSourceId: UUIDv7) => {
    setExpandedDataSourceId((prev) => prev === dataSourceId ? null : dataSourceId);
  }, []);

  const handleRemoveDataSource = useCallback(async (dataSourceId: UUIDv7) => {
    setDeletingDataSourceIds((prev) => {
      const next = new Set(prev);
      next.add(dataSourceId);
      return next;
    });

    try {
      const result = await dispatch(deleteDataSourceThunk({ dataSourceId })).unwrap();
      if (result.deleted) {
        setExpandedDataSourceId((prev) => prev === dataSourceId ? null : prev);
      }
    } finally {
      setDeletingDataSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(dataSourceId);
        return next;
      });
    }
  }, [dispatch]);

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
                  {dataSourceList.map((dataSource) => {
                    const formattedLabel    = formatDataSourceLabel(dataSource.label);
                    const kindLabel         = formatDataSourceKind(dataSource.kind);
                    const isExpanded        = expandedDataSourceId === dataSource.dataSourceId;
                    const isDeleting        = deletingDataSourceIds.has(dataSource.dataSourceId);
                    const detailPanelId     = `data-source-detail-${dataSource.dataSourceId}`;
                    const chevronClassName  = isExpanded
                      ? `${styles['item-chevron-icon']} ${styles['item-chevron-icon-expanded']}`
                      : styles['item-chevron-icon'];

                    return (
                      <li
                        key={dataSource.dataSourceId}
                        className={styles['item']}
                        data-active={isExpanded ? 'true' : undefined}
                      >
                        <div className={styles['item-header']}>
                          <button
                            type="button"
                            className={styles['item-toggle']}
                            onClick={() => handleToggleExpand(dataSource.dataSourceId)}
                            disabled={isDeleting}
                            aria-expanded={isExpanded}
                            aria-controls={detailPanelId}
                            aria-label={isExpanded ? `Collapse ${dataSource.name}` : `Expand ${dataSource.name}`}
                          >
                            <span className={styles['item-chevron']} aria-hidden="true">
                              <Icon name="chevron-right" className={chevronClassName} />
                            </span>

                            <div className={styles['item-main']}>
                              <div className={styles['item-title']}>
                                <span className={styles['item-name']}>{dataSource.name}</span>
                                <span className={styles['badge']}>{kindLabel}</span>
                              </div>
                              <div className={styles['item-meta']}>
                                <span>{formattedLabel ?? ''}</span>
                              </div>
                            </div>
                          </button>

                          <div className={styles['item-actions']}>
                            <button
                              type="button"
                              className={styles['create-button']}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCreateForConnection(dataSource.dataSourceCredentialId);
                              }}
                              disabled={isPending || isDeleting}
                              aria-busy={isPending}
                            >
                              {isPending ? 'Opening…' : 'New Query'}
                            </button>
                          </div>
                        </div>

                        <div
                          className={styles['item-detail']}
                          id={detailPanelId}
                          hidden={!isExpanded}
                          role="region"
                          aria-label={`Connection details for ${dataSource.name}`}
                        >
                          {/* AIDEV-NOTE: The detail panel is always mounted and toggled with `hidden`
                           so aria-controls always points to a real element. */}
                          <dl className={styles['detail-meta']}>
                            <div className={styles['detail-row']}>
                              <dt className={styles['detail-key']}>Kind</dt>
                              <dd className={styles['detail-value']}>{kindLabel}</dd>
                            </div>
                            <div className={styles['detail-row']}>
                              <dt className={styles['detail-key']}>Label</dt>
                              <dd className={styles['detail-value']}>{formattedLabel ?? '—'}</dd>
                            </div>
                          </dl>

                          <div className={styles['detail-danger']}>
                            <button
                              type="button"
                              className={styles['remove-button']}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRemoveDataSource(dataSource.dataSourceId);
                              }}
                              disabled={isDeleting}
                              aria-busy={isDeleting || undefined}
                            >
                              <span className={styles['remove-button-icon']} aria-hidden="true">
                                <Icon name="trash-can" />
                              </span>
                              <span>{isDeleting ? 'Removing…' : 'Remove'}</span>
                            </button>
                          </div>
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
