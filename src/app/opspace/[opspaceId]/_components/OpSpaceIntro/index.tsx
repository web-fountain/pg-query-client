'use client';

import CreateNewQueryButton from './CreateNewQueryButton';
import styles               from '../../../styles.module.css';


function OpSpaceIntro() {
  return (
    <div className={styles['center-page']}>
      <div className={styles['intro']}>
        <img
          className={styles['logo']}
          src="/postgres_logo.svg"
          alt="PostgreSQL logo (SVG)"
        />
        <div className={styles['instructions']}>
          <ul>
            <li>
              <CreateNewQueryButton />
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}


export default OpSpaceIntro;
