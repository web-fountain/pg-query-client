'use client';

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent    as ReactMouseEvent
}                                               from 'react';
import type { FieldError }                      from '@Errors/fieldError';
import type { UUIDv7 }                          from '@Types/primitives';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
}                                               from 'react';
import { FloatingPortal }                       from '@floating-ui/react';

import { reconnectDataSourceCredentialAction }  from '@OpSpaceDataSourceActions';
import { useReduxDispatch, useReduxSelector }   from '@Redux/storeHooks';
import {
  selectDataSourceByCredentialId,
  upsertDataSourceFromFetch
}                                               from '@Redux/records/dataSource';

import styles                                   from './styles.module.css';


type FieldErrorMap = {
  password?      : string;
  persistSecret? : string;
};

function mapFieldErrors(errors: FieldError[] | undefined): { fieldErrors: FieldErrorMap; formError: string | null } {
  const out: FieldErrorMap = {};
  let formError: string | null = null;

  for (const err of (errors || [])) {
    const path = err.path || '';
    if (path === '/password') {
      out.password = err.message || 'Invalid value';
      continue;
    }
    if (path === '/persistSecret') {
      out.persistSecret = err.message || 'Invalid value';
      continue;
    }

    if (!formError && err.message) {
      formError = err.message;
    }
  }

  return { fieldErrors: out, formError };
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const all = Array.from(root.querySelectorAll<HTMLElement>(selector));
  return all.filter((el) => el.getAttribute('data-focus-guard') !== 'true' && !el.hasAttribute('disabled'));
}

type Props = {
  open                    : boolean;
  dataSourceCredentialId  : UUIDv7 | null;
  reasonMessage?          : string | null;
  onClose                 : () => void;
  onSuccess?              : () => void;
};

function ReconnectDataSourceModal(props: Props) {
  const {
    open,
    dataSourceCredentialId,
    reasonMessage,
    onClose,
    onSuccess
  } = props;

  const dispatch                            = useReduxDispatch();
  const dataSourceMeta                      = useReduxSelector(selectDataSourceByCredentialId, dataSourceCredentialId);

  const panelRef                            = useRef<HTMLDivElement | null>(null);
  const passwordInputRef                    = useRef<HTMLInputElement | null>(null);

  const [password, setPassword]             = useState<string>('');
  const [revealPassword, setRevealPassword] = useState<boolean>(false);
  const [persistSecret, setPersistSecret]   = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [formError, setFormError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]       = useState<FieldErrorMap>({});

  const canSubmit = !isReconnecting && !!dataSourceCredentialId;

  const title = useMemo(() => {
    const name = dataSourceMeta?.label || dataSourceMeta?.name || null;
    return name ? `Reconnect to ${name}` : 'Reconnect';
  }, [dataSourceMeta?.label, dataSourceMeta?.name]);

  const subtitle = useMemo(() => {
    return reasonMessage || 'Your connection has expired. Enter your password to reconnect.';
  }, [reasonMessage]);

  const clearFeedback = useCallback(() => {
    setFormError(null);
    setFieldErrors({});
  }, []);

  const wipeSecrets = useCallback(() => {
    // AIDEV-NOTE: Treat connection materials as sensitive; wipe on close/success.
    setPassword('');
    setRevealPassword(false);
  }, []);

  const focusFirst = useCallback(() => {
    const inputEl = passwordInputRef.current;
    if (inputEl) {
      try { inputEl.focus(); } catch {}
      return;
    }

    const panelEl = panelRef.current;
    if (!panelEl) return;
    const focusables = getFocusableElements(panelEl);
    const first = focusables[0];
    try { first?.focus?.(); } catch {}
  }, []);

  const focusLast = useCallback(() => {
    const panelEl = panelRef.current;
    if (!panelEl) return;
    const focusables = getFocusableElements(panelEl);
    const last = focusables[focusables.length - 1];
    try { last?.focus?.(); } catch {}
  }, []);

  useEffect(() => {
    if (!open) {
      clearFeedback();
      setIsReconnecting(false);
      wipeSecrets();
      return;
    }

    clearFeedback();
    setIsReconnecting(false);
    setPersistSecret(Boolean(dataSourceMeta?.persistSecret));

    let raf = 0;
    try {
      raf = requestAnimationFrame(() => {
        focusFirst();
      });
    } catch {
      focusFirst();
    }

    return () => {
      try { cancelAnimationFrame(raf); } catch {}
    };
  }, [clearFeedback, dataSourceMeta?.persistSecret, focusFirst, open, wipeSecrets]);

  const handleOverlayMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
  }, [onClose]);

  const reconnect = useCallback(async () => {
    if (!canSubmit) return;
    if (!dataSourceCredentialId) return;

    clearFeedback();

    if (password.length < 1) {
      setFieldErrors({ password: 'Password is required.' });
      setFormError('Password is required.');
      focusFirst();
      return;
    }

    setIsReconnecting(true);
    try {
      const credentialIdToSync = dataSourceCredentialId;
      const actionResult = await reconnectDataSourceCredentialAction({
        dataSourceCredentialId: credentialIdToSync,
        password,
        persistSecret
      });

      if (!actionResult.success) {
        const mapped = mapFieldErrors(actionResult.error.fields);
        setFieldErrors(mapped.fieldErrors);
        setFormError(mapped.formError || actionResult.error.message || 'Failed to reconnect.');
        focusFirst();
        return;
      }

      if (dataSourceMeta) {
        dispatch(upsertDataSourceFromFetch({
          dataSource: {
            ...dataSourceMeta,
            persistSecret: persistSecret
          }
        }));
      }

      wipeSecrets();
      onClose();
      try { onSuccess?.(); } catch {}
    } catch {
      setFormError('Failed to reconnect.');
      focusFirst();
    } finally {
      setIsReconnecting(false);
    }
  }, [canSubmit, clearFeedback, dataSourceCredentialId, dataSourceMeta, dispatch, focusFirst, onClose, onSuccess, password, persistSecret, wipeSecrets]);

  const handlePasswordKeyDown = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      reconnect();
    }
  }, [reconnect]);

  if (!open) return null;

  const persistLabel = (
    <>
      <span className={styles['persist-label']}>Save password</span>
      <span className={styles['persist-help']}>Store encrypted on the backend so you can reconnect later.</span>
    </>
  );

  return (
    <FloatingPortal>
      <div className={styles['overlay']} onMouseDown={handleOverlayMouseDown}>
        <div
          className={styles['modal']}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reconnect-title"
          onKeyDown={handleKeyDown}
          ref={panelRef}
        >
          <div tabIndex={0} data-focus-guard="true" onFocus={focusLast} aria-hidden="true" />
          <header className={styles['header']}>
            <h2 id="reconnect-title" className={styles['title']}>{title}</h2>
            <div className={styles['subtitle']}>{subtitle}</div>
          </header>

          <div className={styles['body']}>
            {formError && (
              <div className={styles['form-error']} role="alert">
                {formError}
              </div>
            )}

            {!dataSourceCredentialId && (
              <div className={styles['form-error']} role="alert">
                Missing data source credential id.
              </div>
            )}

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="reconnect-password">Password</label>
              <div className={styles['password-row']}>
                <input
                  id="reconnect-password"
                  ref={passwordInputRef}
                  className={fieldErrors.password ? `${styles['input']} ${styles['input-error']}` : styles['input']}
                  type={revealPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  placeholder="Enter password"
                  aria-invalid={fieldErrors.password ? true : undefined}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={2048}
                  disabled={!dataSourceCredentialId}
                />
                <button
                  type="button"
                  className={styles['reveal-button']}
                  onClick={() => setRevealPassword((prev) => !prev)}
                  disabled={!dataSourceCredentialId}
                  aria-pressed={revealPassword}
                >
                  {revealPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password && <div className={styles['field-error']}>{fieldErrors.password}</div>}
            </div>

            <label className={styles['persist-row']}>
              <input
                type="checkbox"
                className={styles['persist-checkbox']}
                checked={persistSecret}
                onChange={(e) => setPersistSecret(e.target.checked)}
                disabled={!dataSourceCredentialId}
              />
              {persistLabel}
            </label>
            {fieldErrors.persistSecret && <div className={styles['field-error']}>{fieldErrors.persistSecret}</div>}
          </div>

          <footer className={styles['footer']}>
            <button
              type="button"
              className={styles['cancel-button']}
              onClick={() => {
                wipeSecrets();
                onClose();
              }}
            >
              Cancel
            </button>

            <div className={styles['footer-spacer']} />

            <button
              type="button"
              className={styles['reconnect-button']}
              onClick={reconnect}
              disabled={!canSubmit}
              aria-busy={isReconnecting}
            >
              {isReconnecting ? 'Reconnecting…' : 'Reconnect'}
            </button>
          </footer>

          <div tabIndex={0} data-focus-guard="true" onFocus={focusFirst} aria-hidden="true" />
        </div>
      </div>
    </FloatingPortal>
  );
}


export default ReconnectDataSourceModal;
