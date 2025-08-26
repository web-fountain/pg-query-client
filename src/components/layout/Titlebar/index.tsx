'use client';

import styles             from './styles.module.css';
import Icon               from '../../Icons';


function Titlebar() {
  return (
    <header className={styles['titlebar']}>
      <div className={styles['title']}>PG Query Client</div>

      <div className={styles['controls']}>
        {/* AIDEV-NOTE: Workspace-specific panel controls removed in favor of global settings. */}
        <button
          className={styles['button']}
          aria-label="Open settings"
          title="Settings"
        >
          <Icon name="gear" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}


export default Titlebar;
