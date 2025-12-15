'use client';

import type {
  OnCreateFolder,
  OnCreateFile,
  OnCollapseAll
} from '../types';
import Icon   from '@Components/Icons';
import styles from './Toolbar.module.css';


type ToolbarProps = {
  onCreateFolder: OnCreateFolder;
  onCreateFile: OnCreateFile;
  disableNewFolder?: boolean;
  onCollapseAll: OnCollapseAll;
  disableCollapseAll?: boolean;
};

function Toolbar({ onCreateFolder, onCreateFile, disableNewFolder, onCollapseAll, disableCollapseAll }: ToolbarProps) {
  return (
    <header className={styles['toolbar']}>
      <div className={styles['tools']}>
        <button
          type="button"
          className={styles['tool']}
          aria-label="New Folder"
          onClick={onCreateFolder}
          title="New Folder"
          disabled={!!disableNewFolder}
        >
          <Icon name="folder-plus" aria-hidden="true" />
        </button>
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
          aria-label="Collapse All Folders"
          onClick={onCollapseAll}
          title="Collapse All Folders"
          disabled={!!disableCollapseAll}
        >
          <Icon name="collapse-all" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}


export default Toolbar;
