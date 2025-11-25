'use client';

import type { ChangeEvent }     from 'react';
import type { UUIDv7 }          from '@Types/primitives';

import {
  memo, useCallback, useEffect,
  useMemo, useRef, useState
}                               from 'react';

import { useReduxDispatch }     from '@Redux/storeHooks';
import {
  updateDataQueryName,
  updateDataQueryText
}                               from '@Redux/records/dataQuery';
import { saveDataQueryThunk }   from '@Redux/records/dataQuery/thunks';
import { useDebouncedCallback } from '@Hooks/useDebounce';
import Icon                     from '@Components/Icons';

import styles                   from './styles.module.css';


type Props = {
  dataQueryId   : UUIDv7;
  queryName     : string;
  isRunning     : boolean;
  saveDisabled  : boolean;
  getCurrentEditorText: () => string;
  onRun         : () => void;
};

function Toolbar({ dataQueryId, queryName: initialQueryName, isRunning, onRun, saveDisabled, getCurrentEditorText }: Props) {
  const dispatch                = useReduxDispatch();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [
    queryName,
    setQueryName
  ]                             = useState<string>(initialQueryName);
  const [
    nameValidationError,
    setNameValidationError
  ]                             = useState<string | null>(null);
  const queryNameRef            = useRef(queryName);
  queryNameRef.current          = queryName;

  const commitNameChange = useCallback((id: UUIDv7, next: string) => {
    const result = dispatch(updateDataQueryName({ dataQueryId: id, name: next }));
    if ((result as any)?.error) {
      const meta = (result as any).meta || {};
      const fields = (meta?.errorInfo?.fields || []) as Array<{ path: string; message: string }>;
      const fieldMsg = fields.find(f => f.path === '/name' || f.path === 'name')?.message;
      const msg = fieldMsg || meta?.errorInfo?.message || (result as any)?.payload?.message || 'Invalid name';
      setNameValidationError(msg);
    } else {
      setNameValidationError(null);
    }
  }, [dispatch]);

  const debouncedCommit = useDebouncedCallback(commitNameChange, 200);

  const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setQueryName(name);
    debouncedCommit(dataQueryId, name);
  }, [dataQueryId, debouncedCommit]);

  const handleSaveClick = useCallback(async () => {
    // Flush any pending name changes immediately
    debouncedCommit.flush(dataQueryId, queryNameRef.current);

    setIsSaving(true);
    try {
      const latestText = getCurrentEditorText?.() || '';
      // Update text and trigger save
      dispatch(updateDataQueryText({ dataQueryId, queryText: latestText }));
      await dispatch(saveDataQueryThunk({ dataQueryId })).unwrap();
    } catch {
      // Error handling if needed (thunk usually handles notification)
    } finally {
      setIsSaving(false);
    }
  }, [dataQueryId, debouncedCommit, dispatch, getCurrentEditorText]);

  useEffect(() => {
    setQueryName(initialQueryName);
    setNameValidationError(null);
  }, [initialQueryName]);

  useEffect(() => {
    return () => {
      debouncedCommit.flush(dataQueryId, queryNameRef.current);
    };
  }, [dataQueryId, debouncedCommit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saveDisabled && !isSaving && !nameValidationError) {
          handleSaveClick();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveDisabled, isSaving, nameValidationError, handleSaveClick]);

  const inputClassName = useMemo(
    () => nameValidationError
      ? `${styles['name-input']} ${styles['name-input-invalid']}`
      : styles['name-input'],
    [nameValidationError]
  );

  return (
    <div className={styles['toolbar']}>
      <div className={styles['name-group']}>
        <input
          className={inputClassName}
          value={queryName}
          onChange={onNameChange}
          placeholder="Query Name"
          aria-label="Query name"
          aria-invalid={nameValidationError ? true : undefined}
          title={nameValidationError || undefined}
        />
        <div className={styles['actions']}>
          <button
            className={styles['save-button']}
            title={isSaving ? 'Saving…' : 'Save'}
            aria-label={isSaving ? 'Saving' : 'Save'}
            aria-busy={isSaving}
            onClick={handleSaveClick}
            disabled={saveDisabled || isSaving || !!nameValidationError}
          >
            {isSaving ? <Icon name="rotate-right" className={styles['spin']} /> : <Icon name="floppy-disk" />}
          </button>
          <span className={styles['spacer']} />
          <button
            className={styles['run-button']}
            title="Run"
            aria-label="Run"
            onClick={onRun}
            disabled={isRunning}
          >
            <Icon name="play" />
          </button>
        </div>
      </div>
    </div>
  );
}


export default memo(Toolbar);
