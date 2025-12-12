'use client';

import type { ChangeEvent }                   from 'react';
import type { UUIDv7 }                        from '@Types/primitives';

import {
  memo, useCallback, useEffect, useMemo,
  useRef, useState
}                                             from 'react';

import { useReduxDispatch, useReduxSelector } from '@Redux/storeHooks';
import {
  selectDataQueryRecord, updateDataQueryName,
  updateDataQueryText
}                                             from '@Redux/records/dataQuery';
import { saveDataQueryThunk }                 from '@Redux/records/dataQuery/thunks';
import { useDebouncedCallback }               from '@Hooks/useDebounce';
import Icon                                   from '@Components/Icons';
import { useSqlRunner }                       from '../../../../_providers/SQLRunnerProvider';
import { useQueriesRoute }                    from '../../../_providers/QueriesRouteProvider';

import styles                                 from './styles.module.css';


type Props = {
  dataQueryId           : UUIDv7;
  onRun                 : () => void;
  getCurrentEditorText  : () => string;
};

function Toolbar({ dataQueryId, onRun, getCurrentEditorText }: Props) {
  const { isRunning }           = useSqlRunner();
  const { navigateToSaved }     = useQueriesRoute();
  const record                  = useReduxSelector(selectDataQueryRecord, dataQueryId);
  const dispatch                = useReduxDispatch();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [
    queryName,
    setQueryName
  ]                             = useState<string>(record?.current?.name ?? record?.persisted?.name ?? '');
  const [
    nameValidationError,
    setNameValidationError
  ]                             = useState<string | null>(null);
  const queryNameRef            = useRef(queryName);
  const recordRef               = useRef(record);
  const hasPendingNameCommitRef = useRef(false);

  queryNameRef.current          = queryName;
  recordRef.current             = record;

  const canSave                 = !!record?.isUnsaved && !isSaving && !nameValidationError;

  const commitNameChange = useCallback((id: UUIDv7, next: string) => {
    // AIDEV-NOTE: Debounced Redux commit for name edits; clear pending flag once it runs.
    hasPendingNameCommitRef.current = false;
    dispatch(updateDataQueryName({ dataQueryId: id, name: next }));
  }, [dispatch]);
  const debouncedCommit = useDebouncedCallback(commitNameChange, 200);

  const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setQueryName(name);
    // AIDEV-NOTE: Mark pending debounced write so Save/unmount can flush unsent name edits.
    hasPendingNameCommitRef.current = true;
    debouncedCommit(dataQueryId, name);
  }, [dataQueryId, debouncedCommit]);

  const handleSaveClick = useCallback(async () => {
    const currentRecord = recordRef.current;
    if (!currentRecord) return;

    setIsSaving(true);

    // AIDEV-NOTE: Flush pending name changes before saving, but only if a debounce is outstanding.
    if (hasPendingNameCommitRef.current) {
      debouncedCommit.flush(dataQueryId, queryNameRef.current);
      hasPendingNameCommitRef.current = false;
    }

    // AIDEV-NOTE: SQLEditor writes queryText debounced; Save forces Redux to the latest editor text before thunk runs.
    const latestText = getCurrentEditorText?.();
    const currentText = currentRecord.current?.queryText;

    if (latestText !== currentText) {
      dispatch(updateDataQueryText({ dataQueryId, queryText: latestText }));
    }

    // AIDEV-TODO: Validate name uniqueness within the current query tree (or surface a backend duplicate-name error) before saving.

    try {
      const result = await dispatch(saveDataQueryThunk({ dataQueryId })).unwrap();

      // AIDEV-NOTE: Only transition from /queries/new → /queries/:id when a true
      // promotion has completed successfully. Regular saves remain on the saved route.
      if (result && result.success && result.isPromotion) {
        navigateToSaved(dataQueryId);
      }
    } finally {
      setIsSaving(false);
    }
  }, [dataQueryId, debouncedCommit, dispatch, getCurrentEditorText, navigateToSaved]);

  useEffect(() => {
    const name = record?.current?.name ?? record?.persisted?.name ?? '';
    setQueryName(name);
  }, [record?.current?.name, record?.persisted?.name]);

  useEffect(() => {
    return () => {
      // AIDEV-NOTE: On unmount (or dataQueryId change) only flush if there is
      // a pending debounced write. This prevents spurious updateDataQueryName
      // actions when the user is just switching between tabs.
      if (hasPendingNameCommitRef.current) {
        debouncedCommit.flush(dataQueryId, queryNameRef.current);
        hasPendingNameCommitRef.current = false;
      }
    };
  }, [dataQueryId, debouncedCommit]);

  useEffect(() => {
    if (!record) {
      setNameValidationError(null);
      return;
    }
    const invalidName = record.invalid?.name as { message?: string } | undefined;
    if (record.isInvalid && invalidName) {
      setNameValidationError(invalidName.message || 'Invalid name');
    } else {
      setNameValidationError(null);
    }
  }, [record]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (canSave) {
          handleSaveClick();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, handleSaveClick]);

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
            disabled={!canSave}
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
