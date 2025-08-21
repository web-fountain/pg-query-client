import SQLEditor    from '../components/SQLEditor';
import QueryResults from '../components/QueryResults';
import styles       from './styles.module.css';


function Home() {
  return (
    <>
      <div className={styles['sql-editor-section']}>
        <SQLEditor />
      </div>
      <div className={styles['query-results-section']}>
        <QueryResults />
      </div>
    </>
  );
}


export default Home;
