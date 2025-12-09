'use client';

import PanelLayout from '@Components/layout/PanelLayout';
import LeftPanel from '@Components/layout/PanelLayout/LeftPanel';
import MainPanel from '@Components/layout/PanelLayout/MainPanel';
import RightPanel from '@Components/layout/PanelLayout/RightPanel';
import Titlebar from '@Components/layout/Titlebar';

import styles from './OpSpaceShellSkeleton.module.css';


function OpSpaceShellSkeleton() {
  return (
    <div className={styles['shell']}>
      <Titlebar />

      <PanelLayout>
        <LeftPanel>
          <div className={styles['panel-shell']}>
            <div className={styles['panel-header-skeleton']} />
            <div className={styles['panel-body-skeleton']}>
              <div className={styles['line']} />
              <div className={styles['line']} />
              <div className={styles['line-short']} />
            </div>
          </div>
        </LeftPanel>

        <MainPanel>
          <div className={styles['main-shell']}>
            <div className={styles['main-header-skeleton']} />
            <div className={styles['main-body-skeleton']}>
              <div className={styles['block']} />
              <div className={styles['block']} />
            </div>
          </div>
        </MainPanel>

        <RightPanel>
          <div className={styles['panel-shell']}>
            <div className={styles['panel-header-skeleton']} />
            <div className={styles['panel-body-skeleton']}>
              <div className={styles['line']} />
              <div className={styles['line']} />
              <div className={styles['line-short']} />
            </div>
          </div>
        </RightPanel>
      </PanelLayout>
    </div>
  );
}


export default OpSpaceShellSkeleton;
