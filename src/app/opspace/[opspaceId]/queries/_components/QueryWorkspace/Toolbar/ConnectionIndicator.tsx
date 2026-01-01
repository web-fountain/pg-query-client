'use client';

import type { DataSourceMeta }                  from '@Redux/records/dataSource/types';

import { memo, useCallback, useMemo, useState } from 'react';
import {
  FloatingPortal, autoUpdate, flip, offset,
  useClick, useDismiss, useFloating,
  useInteractions, useRole
}                                               from '@floating-ui/react';

import { useDataSourceUI }                      from '@OpSpaceProviders/DataSourceProvider';
import { setActiveDataSourceAction }            from '@OpSpaceDataSourceActions';
import { useReduxDispatch, useReduxSelector }   from '@Redux/storeHooks';
import {
  selectActiveDataSourceId,
  selectActiveDataSourceMeta,
  selectDataSourceList,
  setActiveDataSourceId
}                                               from '@Redux/records/dataSource';
import Icon                                     from '@Components/Icons';

import styles                                   from './styles.module.css';


function formatConnectionLabel(ds: DataSourceMeta): string {
  const host  = ds.host || '';
  const port  = typeof ds.port === 'number' ? String(ds.port) : '';
  const db    = ds.database || '';
  const user  = ds.username || '';

  const parts = [];
  if (ds.serverGroupName) parts.push(ds.serverGroupName);
  if (user && host) parts.push(`${user}@${host}${port ? `:${port}` : ''}`);
  if (db) parts.push(db);
  return parts.join(' · ') || 'Connection';
}

function ConnectionIndicator() {
  const { openConnectServerModal }  = useDataSourceUI();
  const dataSourceList              = useReduxSelector(selectDataSourceList);
  const activeId                    = useReduxSelector(selectActiveDataSourceId);
  const activeMeta                  = useReduxSelector(selectActiveDataSourceMeta);
  const dispatch                    = useReduxDispatch();
  const [open, setOpen]             = useState<boolean>(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange          : setOpen,
    placement             : 'bottom-end',
    whileElementsMounted  : autoUpdate,
    strategy              : 'fixed',
    middleware            : [
      offset({ mainAxis: 6, crossAxis: 0 }),
      flip({ padding: 8 })
    ]
  });

  const click   = useClick(context, { event: 'click' });
  const dismiss = useDismiss(context);
  const role    = useRole(context, { role: 'listbox' });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const triggerLabel = useMemo(() => {
    if (!activeMeta) return 'No server connected';
    return activeMeta.serverGroupName || 'Connected';
  }, [activeMeta]);

  const triggerSubLabel = useMemo(() => {
    if (!activeMeta) return 'Connect a server to run queries';
    const host  = activeMeta.host || '';
    const port  = typeof activeMeta.port === 'number' ? String(activeMeta.port) : '';
    const db    = activeMeta.database || '';
    return `${host}${port ? `:${port}` : ''}${db ? ` · ${db}` : ''}`;
  }, [activeMeta]);

  const handleSelect = useCallback((dataSourceId: DataSourceMeta['dataSourceId']) => {
    dispatch(setActiveDataSourceId({ dataSourceId }));
    setOpen(false);
    void setActiveDataSourceAction(dataSourceId).catch(() => {});
  }, [dispatch]);

  return (
    <div className={styles['connection-root']}>
      <button
        type="button"
        className={styles['connection-trigger']}
        ref={refs.setReference}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={activeMeta ? formatConnectionLabel(activeMeta) : 'Connect a server'}
        {...getReferenceProps()}
      >
        <span className={styles['connection-icon']} aria-hidden="true">
          <Icon name="database" />
        </span>
        <span className={styles['connection-text']}>
          <span className={styles['connection-title']}>{triggerLabel}</span>
          <span className={styles['connection-subtitle']}>{triggerSubLabel}</span>
        </span>
        <span className={styles['connection-chevron']} aria-hidden="true">
          <Icon name="chevron-down" />
        </span>
      </button>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={styles['connection-popover']}
            {...getFloatingProps()}
          >
            {dataSourceList.length === 0 ? (
              <div className={styles['connection-empty']}>
                <div className={styles['connection-empty-title']}>No connections</div>
                <div className={styles['connection-empty-subtitle']}>Connect a server to start querying.</div>
                <button
                  type="button"
                  className={styles['connection-connect']}
                  onClick={() => {
                    setOpen(false);
                    openConnectServerModal();
                  }}
                >
                  Connect a server
                </button>
              </div>
            ) : (
              <ul role="listbox" className={styles['connection-options']} aria-label="Connections">
                {dataSourceList.map((ds) => {
                  const selected = ds.dataSourceId === activeId;
                  return (
                    <li key={ds.dataSourceId} role="none">
                      <button
                        type="button"
                        role="option"
                        className={styles['connection-option']}
                        data-selected={selected || undefined}
                        aria-selected={selected || undefined}
                        onClick={() => handleSelect(ds.dataSourceId)}
                      >
                        <div className={styles['connection-option-title']}>{ds.serverGroupName}</div>
                        <div className={styles['connection-option-subtitle']}>
                          {ds.username}@{ds.host}:{ds.port} · {ds.database} · TLS: {ds.sslMode}
                        </div>
                      </button>
                    </li>
                  );
                })}
                <li className={styles['connection-divider']} aria-hidden="true" />
                <li className={styles['connection-footer']} role="none">
                  <button
                    type="button"
                    className={styles['connection-connect']}
                    onClick={() => {
                      setOpen(false);
                      openConnectServerModal();
                    }}
                  >
                    Connect a server
                  </button>
                </li>
              </ul>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}


export default memo(ConnectionIndicator);
