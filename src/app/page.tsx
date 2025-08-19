import ThemeToggle from '@Components/ThemeToggle';
import styles from './styles.module.css';


function Home() {
  return (
    <div className={styles['page']}>
      <ThemeToggle />
      <main className={styles['main']}>
        <h1>ok.<br />Let&apos;s get to work!</h1>
      </main>
    </div>
  );
}


export default Home;
