'use client';

import type { OnCreateFile, OnCloseAll }  from '../types';
import Icon                               from '@Components/Icons';
import styles                             from './Toolbar.module.css';


type ToolbarProps = {
  onCreateFile          : OnCreateFile;
  onCloseAll            : OnCloseAll;
  disableCloseAll?      : boolean;
  isCreatePending?      : boolean;
  disableCreateFile?    : boolean;
  disableCreateReason?  : string;
};

function Toolbar({ onCreateFile, onCloseAll, disableCloseAll, isCreatePending, disableCreateReason }: ToolbarProps) {
  const createDisabled = !!isCreatePending;
  const createTitle = createDisabled
    ? (disableCreateReason || 'Connect a server to create a new query')
    : 'New Untitled Query';

  return (
    <header className={styles['toolbar']}>
      <div className={styles['tools']}>
        <button
          type="button"
          className={styles['tool']}
          aria-label="New Untitled Query"
          onClick={onCreateFile}
          title={createTitle}
          disabled={createDisabled}
          aria-disabled={createDisabled}
          aria-busy={!!isCreatePending}
        >
          <Icon name="file-plus" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles['tool']}
          aria-label="Close All"
          onClick={onCloseAll}
          title="Close All"
          disabled={!!disableCloseAll}
        >
          <Icon name="close-all" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}


export default Toolbar;
