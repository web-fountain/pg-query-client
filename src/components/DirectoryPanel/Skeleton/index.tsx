import styles from './styles.module.css';


// AIDEV-NOTE: Minimal right-panel skeleton for initial tree loading.
// Keep markup aligned with DirectoryPanel's visual structure so the
// transition feels smooth when content hydrates.
function Skeleton() {
  return (
    <div
      className={styles['directory-panel-skeleton']}
      role="status"
      aria-busy="true"
      aria-label="Loading queries"
    >
      <div className={styles['sections']}>
        <div className={styles['section']}>
          <div className={styles['header']}>
            <div className={styles['header-left']}>
              <div className={styles['toggle']} />
              <div className={styles['title-skeleton']} />
            </div>
            <div className={styles['tools-skeleton']} />
          </div>
          <div className={styles['rows']}>
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
          </div>
        </div>

        <div className={styles['section']}>
          <div className={styles['header']}>
            <div className={styles['header-left']}>
              <div className={styles['toggle']} />
              <div className={styles['title-skeleton']} />
            </div>
            <div className={styles['tools-skeleton']} />
          </div>
          <div className={styles['rows']}>
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
            <div className={styles['row-skeleton']} />
          </div>
        </div>
      </div>
    </div>
  );
}


export default Skeleton;
