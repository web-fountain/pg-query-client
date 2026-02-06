'use client';

import type { DataSourceMeta }                from '@Redux/records/dataSource/types';

import { useCallback, useMemo, useState }     from 'react';
import {
  FloatingPortal, autoUpdate, flip, offset,
  useClick, useDismiss, useFloating,
  useInteractions, useRole
}                                             from '@floating-ui/react';

import { useDataSourceUI }                    from '@OpSpaceProviders/DataSourceProvider';
import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import {
  selectActiveTabDataSourceCredentialId,
  selectDataSourceByCredentialId,
  selectDataSourceList
}                                             from '@Redux/records/dataSource';
import { switchActiveTabConnectionThunk }     from '@Redux/records/tabbar/thunks';
import Icon                                   from '@Components/Icons';

import styles                                 from './styles.module.css';


function formatDataSourceKind(kind: DataSourceMeta['kind']): string {
  return kind === 'pglite' ? 'PGlite' : 'Postgres';
}

function formatDataSourceTitle(dataSource: DataSourceMeta): string {
  return dataSource.label || dataSource.name;
}

function formatDataSourceSubtitle(dataSource: DataSourceMeta): string {
  const parts: string[] = [];
  parts.push(formatDataSourceKind(dataSource.kind));
  if (dataSource.label) parts.push(dataSource.name);
  return parts.join(' · ');
}

function formatDataSourceTooltip(dataSource: DataSourceMeta): string {
  const subtitle = formatDataSourceSubtitle(dataSource);
  return subtitle;
}

type Props = {
  isRunning: boolean;
};

function ConnectionIndicator({ isRunning }: Props) {
  const { openConnectDataSourceModal }  = useDataSourceUI();
  const dataSourceList                  = useReduxSelector(selectDataSourceList);
  const selectedDataSourceCredentialId  = useReduxSelector(selectActiveTabDataSourceCredentialId);
  const selectedDataSource              = useReduxSelector(selectDataSourceByCredentialId, selectedDataSourceCredentialId);
  const dispatch                        = useReduxDispatch();
  const [open, setOpen]                 = useState<boolean>(false);

  const canSwitchConnection = !isRunning;

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

  const trigger = useMemo(() => {
    if (selectedDataSource) {
      return {
        label    : formatDataSourceSubtitle(selectedDataSource),
        subLabel : formatDataSourceTitle(selectedDataSource),
        title    : formatDataSourceTooltip(selectedDataSource)
      };
    }

    if (selectedDataSourceCredentialId) {
      return {
        label    : 'Unknown connection',
        subLabel : 'Select a data source',
        title    : 'The selected connection is not available in the current data source list.'
      };
    }

    return {
      label    : 'No connection',
      subLabel : 'Select a data source',
      title    : 'Select a data source to run queries.'
    };
  }, [selectedDataSource, selectedDataSourceCredentialId]);

  const triggerTitle = isRunning
    ? `${trigger.title} — Connection switching is disabled while a query is running.`
    : trigger.title;

  const handleSelect = useCallback((dataSource: DataSourceMeta) => {
    setOpen(false);
    if (!canSwitchConnection) return;
    if (dataSource.dataSourceCredentialId === selectedDataSourceCredentialId) return;

    dispatch(switchActiveTabConnectionThunk(dataSource.dataSourceCredentialId));
  }, [canSwitchConnection, dispatch, selectedDataSourceCredentialId]);

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
          <span className={styles['connection-title']}>{trigger.label}</span>
          <span className={styles['connection-subtitle']}>{trigger.subLabel}</span>
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
              {dataSourceList.length === 0 && (
                <li role="none" className={styles['connection-empty']}>
                  <div className={styles['connection-empty-title']}>No data sources</div>
                  <div className={styles['connection-empty-subtitle']}>
                    Connect a data source to run queries.
                  </div>
                </li>
              )}

              {dataSourceList.map((dataSource) => {
                const selected = dataSource.dataSourceCredentialId === selectedDataSourceCredentialId;
                const isDisabled = selected || !canSwitchConnection;
                const optionTitle = !canSwitchConnection
                  ? 'Connection switching is disabled while a query is running.'
                  : undefined;

                return (
                  <li key={dataSource.dataSourceId} role="none">
                    <button
                      type="button"
                      role="option"
                      className={styles['connection-option']}
                      data-selected={selected || undefined}
                      aria-selected={selected || undefined}
                      disabled={isDisabled}
                      title={optionTitle}
                      onClick={() => handleSelect(dataSource)}
                    >
                      <div className={styles['connection-option-title']}>{formatDataSourceTitle(dataSource)}</div>
                      <div className={styles['connection-option-subtitle']}>
                        {formatDataSourceSubtitle(dataSource)}
                      </div>
                    </button>
                  </li>
                );
              })}

              {dataSourceList.length > 0 && (
                <li className={styles['connection-divider']} aria-hidden="true" />
              )}
              <li className={styles['connection-footer']} role="none">
                <button
                  type="button"
                  className={styles['connection-connect']}
                  onClick={() => {
                    setOpen(false);
                    openConnectDataSourceModal();
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


export default ConnectionIndicator;
