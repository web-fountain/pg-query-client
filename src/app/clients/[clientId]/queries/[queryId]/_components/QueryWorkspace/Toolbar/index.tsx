import Icon   from '@Components/Icons';
import styles from './styles.module.css';


type Props = {
  name          : string;
  isRunning     : boolean;
  saveDisabled  : boolean;
  onRun         : () => void;
  onSave        : () => void;
  onNameChange  : (v: string) => void;
};

function Toolbar({ name, onNameChange, isRunning, onRun, onSave, saveDisabled }: Props) {
  return (
    <div className={styles['toolbar']}>
      <div className={styles['name-group']}>
        <input
          className={styles['name-input']}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="serialize"
          aria-label="Query name"
        />
        <button
          className={styles['icon-button']}
          title="Save"
          aria-label="Save"
          onClick={onSave}
          disabled={saveDisabled}
        >
          <Icon name="floppy-disk" />
        </button>
        <button
          className={styles['icon-button-primary']}
          title="Run"
          aria-label="Run"
          onClick={onRun}
          disabled={isRunning}
        >
          <Icon name="play" />
        </button>
      </div>
    </div>
  );
}


export default Toolbar;
