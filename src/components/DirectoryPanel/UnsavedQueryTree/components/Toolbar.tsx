'use client';

import type { OnCreateFile, OnCloseAll } from '../types';
import Icon   from '@Components/Icons';
import styles from './Toolbar.module.css';


type ToolbarProps = {
  onCreateFile: OnCreateFile;
  onCloseAll: OnCloseAll;
  disableCloseAll?: boolean;
};

function Toolbar({ onCreateFile, onCloseAll, disableCloseAll }: ToolbarProps) {
  return (
    <header className={styles['toolbar']}>
      <div className={styles['tools']}>
        <button
          type="button"
          className={styles['tool']}
          aria-label="New File"
          onClick={onCreateFile}
          title="New File"
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
