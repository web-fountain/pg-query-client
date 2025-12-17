'use client';

import type {
  OnCollapseAll,
  OnCreateFile,
  OnCreateFolder
}               from '../types';
import Icon     from '@Components/Icons';
import Toolbar  from './Toolbar';
import styles   from '../styles.module.css';


type Props = {
  label               : string;
  isOpen              : boolean;
  onToggle            : () => void;
  onCreateFolder      : OnCreateFolder;
  onCreateFile        : OnCreateFile;
  onCollapseAll       : OnCollapseAll;
  disableCollapseAll? : boolean;
};

function SectionHeader({ label, isOpen, onToggle, onCreateFolder, onCreateFile, onCollapseAll, disableCollapseAll }: Props) {
  return (
    <div
      className={styles['header']}
      role="heading"
      aria-level={2}
      tabIndex={0}
      aria-expanded={isOpen ? 'true' : 'false'}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className={styles['header-left']}>
        <button
          type="button"
          className={styles['header-toggle']}
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isOpen ? (<Icon name="chevron-down" aria-hidden="true" />) : (<Icon name="chevron-right" aria-hidden="true" />)}
        </button>
        <span className={styles['header-label']}>{label.toUpperCase()}</span>
      </div>

      {/* AIDEV-NOTE: Always render toolbar; reveal via CSS only when expanded + hovered */}
      <div
        className={styles['header-tools']}
        onClick={(e) => { e.stopPropagation(); }}
        onKeyDown={(e) => { e.stopPropagation(); }}
      >
        <Toolbar
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onCollapseAll={onCollapseAll}
          disableCollapseAll={disableCollapseAll}
        />
      </div>
    </div>
  );
}


export default SectionHeader;
