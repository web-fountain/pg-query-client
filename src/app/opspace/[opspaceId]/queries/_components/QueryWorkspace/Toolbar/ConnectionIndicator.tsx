'use client';

import type { DataSourceMeta }              from '@Redux/records/dataSource/types';

import { memo, useCallback, useState }      from 'react';
import {
  FloatingPortal, autoUpdate, flip, offset,
  useClick, useDismiss, useFloating,
  useInteractions, useRole
}                                           from '@floating-ui/react';

import { useDataSourceUI }                  from '@OpSpaceProviders/DataSourceProvider';
import { useReduxSelector }                 from '@Redux/storeHooks';
import { selectDataSourceList }             from '@Redux/records/dataSource';
import { selectActiveTabDataSource }        from '@Redux/records/tabbar';
import Icon                                 from '@Components/Icons';

import styles                               from './styles.module.css';


function formatDataSourceKind(kind: DataSourceMeta['kind']): string {
  return kind === 'pglite' ? 'PGlite' : 'Postgres';
}

function formatDataSourceTitle(ds: DataSourceMeta): string {
  return ds.label || ds.name;
}

function formatDataSourceSubtitle(ds: DataSourceMeta): string {
  const parts: string[] = [];
  parts.push(formatDataSourceKind(ds.kind));
  if (ds.label) parts.push(ds.name);
  return parts.join(' · ');
}

function formatDataSourceTooltip(ds: DataSourceMeta): string {
  const title = formatDataSourceTitle(ds);
  const sub = formatDataSourceSubtitle(ds);
  // return sub ? `${title} — ${sub}` : title;
  return sub;
}

function ConnectionIndicator() {
  const { openConnectServerModal }  = useDataSourceUI();
  const dataSourceList              = useReduxSelector(selectDataSourceList);
  const currentSelectedDataSource   = useReduxSelector(selectActiveTabDataSource);
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

  const triggerLabel    = formatDataSourceSubtitle(currentSelectedDataSource!);
  const triggerSubLabel = formatDataSourceTitle(currentSelectedDataSource!);
  const triggerTitle    = formatDataSourceTooltip(currentSelectedDataSource!);

  const handleSelect = useCallback((ds: DataSourceMeta) => {
    setOpen(false);
    if (ds.dataSourceCredentialId === currentSelectedDataSource!.dataSourceCredentialId) return;

    // AIDEV-TODO: Also update the active tab's `dataSourceCredentialId` (per-tab connection)
    // when the tab connection switch thunk is implemented.
    // dispatch(switchTabConnectionAction(ds.dataSourceCredentialId));
  }, [currentSelectedDataSource!.dataSourceCredentialId]);

  return (
    <div className={styles['connection-root']}>
      <button
        type="button"
        className={styles['connection-trigger']}
        ref={refs.setReference}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={triggerTitle}
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
            <ul role="listbox" className={styles['connection-options']} aria-label="Data sources">
              {dataSourceList.map((ds) => {
                const selected = ds.dataSourceCredentialId === currentSelectedDataSource!.dataSourceCredentialId;
                return (
                  <li key={ds.dataSourceId} role="none">
                    <button
                      type="button"
                      role="option"
                      className={styles['connection-option']}
                      data-selected={selected || undefined}
                      aria-selected={selected || undefined}
                      onClick={() => handleSelect(ds)}
                    >
                      <div className={styles['connection-option-title']}>{formatDataSourceTitle(ds)}</div>
                      <div className={styles['connection-option-subtitle']}>
                        {formatDataSourceSubtitle(ds)}
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
                  Connect a data source
                </button>
              </li>
            </ul>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}


export default memo(ConnectionIndicator);
