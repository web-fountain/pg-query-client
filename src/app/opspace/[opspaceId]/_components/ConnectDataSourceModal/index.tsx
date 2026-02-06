'use client';

import type {
  ClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent    as ReactMouseEvent
}                                       from 'react';
import type { PostgresDataSourceDraft } from '@Redux/records/dataSource/types';
import type { FieldError }              from '@Errors/fieldError';
import type { UUIDv7 }                  from '@Types/primitives';
import type {
  DataSource,
  DbSslMode,
  PostgresDataSourceTestPayload
}                                       from '@Types/dataSource';

import {
  useCallback, useEffect,
  useMemo, useRef,
  useState
}                                       from 'react';
import { FloatingPortal }               from '@floating-ui/react';

import { useReduxDispatch }             from '@Redux/storeHooks';
import { upsertDataSourceFromFetch }    from '@Redux/records/dataSource';
import {
  validateDataSourceDraftForCreate,
  validateDataSourceDraftForTest
}                                       from '@Redux/records/dataSource/validation';
import {
  createDataSourceAction,
  testDataSourceAction
}                                       from '@OpSpaceDataSourceActions';
import { generateUUIDv7 }               from '@Utils/generateId';

import styles                           from './styles.module.css';


type Props = {
  open: boolean;
  onClose: () => void;
};

type FieldErrorMap = Partial<Record<
  | 'kind'
  | 'name'
  | 'host'
  | 'port'
  | 'username'
  | 'password'
  | 'database'
  | 'sslMode',
  string
>>;

// AIDEV-NOTE: Tracks whether the user is primarily entering via URI or individual params.
// 'uri'    = user pasted/typed a connection string first
// 'params' = user typed in host/port/user/password first
// 'none'   = neither has been touched yet
type InputMode = 'none' | 'uri' | 'params';

type ParsedUri = {
  host?     : string;
  port?     : number;
  username? : string;
  password? : string;
  database? : string;
};

const DATA_SOURCE_KIND = 'postgres' as const;

const SSL_MODE_OPTIONS: Array<{ value: DbSslMode; label: string }> = [
  { value: 'disable'    , label: 'disable'     },
  { value: 'prefer'     , label: 'prefer'      },
  { value: 'require'    , label: 'require'     },
  { value: 'verify-ca'  , label: 'verify-ca'   },
  { value: 'verify-full', label: 'verify-full' }
];

// AIDEV-NOTE: Constant redaction token for password display - never leaks length.
const REDACTED_PASSWORD = '[PASSWORD]';

// AIDEV-NOTE: Lenient decoder for userinfo (username/password) that won't throw on stray '%'.
// Converts stray '%' (not followed by two hex digits) into '%25' before decoding.
function decodeUserInfoLenient(value: string): string {
  if (!value) return '';
  const normalized = value.replace(/%(?![0-9a-fA-F]{2})/g, '%25');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return value;
  }
}

// AIDEV-NOTE: Parse a postgres:// or postgresql:// URI and extract connection params.
// Resilient parser that handles special chars in passwords (#, ?, /, %, @) by:
// 1) Splitting authority (userinfo + host) from path/query/fragment
// 2) Extracting userinfo using last '@' in authority
// 3) Using lenient decoding that won't throw on stray '%'
// Returns undefined if the URI is not parseable.
function parsePostgresUri(uri: string): ParsedUri | undefined {
  if (!uri) return undefined;

  const trimmed = uri.trim();

  // Validate and extract scheme
  const scheme = trimmed.startsWith('postgresql://')
    ? 'postgresql://'
    : trimmed.startsWith('postgres://')
      ? 'postgres://'
      : null;

  if (!scheme) return undefined;

  const rest = trimmed.slice(scheme.length);

  // Find the end of authority (first /, ?, or # marks path/query/fragment)
  let authorityEnd = rest.length;
  for (let charIndex = 0; charIndex < rest.length; charIndex++) {
    const currentChar = rest[charIndex];
    if (currentChar === '/' || currentChar === '?' || currentChar === '#') {
      authorityEnd = charIndex;
      break;
    }
  }

  const authorityRaw = rest.slice(0, authorityEnd);
  const pathAndRest = rest.slice(authorityEnd);

  // Find userinfo using LAST '@' in authority (handles @ in password)
  const atIndex = authorityRaw.lastIndexOf('@');

  const userinfoRaw = atIndex >= 0 ? authorityRaw.slice(0, atIndex) : '';
  const hostPortRaw = atIndex >= 0 ? authorityRaw.slice(atIndex + 1) : authorityRaw;

  // Parse host/port/path using URL constructor (userinfo removed, so safe)
  let url: URL;
  try {
    url = new URL(`http://${hostPortRaw}${pathAndRest}`);
  } catch {
    return undefined;
  }

  // Extract and decode userinfo
  let username: string | undefined;
  let password: string | undefined;

  if (atIndex >= 0 && userinfoRaw) {
    // Find FIRST ':' in userinfo (password may contain colons)
    const colonIndex = userinfoRaw.indexOf(':');
    const usernameEnc = colonIndex >= 0 ? userinfoRaw.slice(0, colonIndex) : userinfoRaw;
    const passwordEnc = colonIndex >= 0 ? userinfoRaw.slice(colonIndex + 1) : '';

    const decodedUsername = usernameEnc ? decodeUserInfoLenient(usernameEnc) : '';
    const decodedPassword = passwordEnc ? decodeUserInfoLenient(passwordEnc) : '';

    username = decodedUsername || undefined;
    password = decodedPassword || undefined;
  }

  const host = url.hostname || undefined;
  const portStr = url.port;
  const port = portStr ? Number.parseInt(portStr, 10) : undefined;
  const database = url.pathname ? decodeUserInfoLenient(url.pathname.replace(/^\//, '')) : undefined;

  return {
    host: host || undefined,
    port: Number.isFinite(port) ? port : undefined,
    username: username || undefined,
    password: password || undefined,
    database: database || undefined
  };
}

// AIDEV-NOTE: Build a preview URI from individual params for display when in params mode.
// Shows placeholders for missing values; password always shows as [PASSWORD] (no length leak).
function buildPreviewUri(params: {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}): string {
  const { host, port, username, password, database } = params;

  const hostTrimmed = host.trim();
  const portPart = port.trim() || '5432';
  const userPart = username.trim() || '<user>';
  const passPart = password.length > 0 ? REDACTED_PASSWORD : '<password>';
  const dbPart = database.trim() || '<database>';

  // AIDEV-NOTE: Bracket IPv6 hosts for valid URI syntax
  const hostPart = hostTrimmed
    ? (hostTrimmed.includes(':') && !hostTrimmed.startsWith('[') ? `[${hostTrimmed}]` : hostTrimmed)
    : '<host>';

  return `postgresql://${userPart}:${passPart}@${hostPart}:${portPart}/${dbPart}`;
}

function normalizeString(value: string): string | undefined {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapFieldErrors(fields: FieldError[] | undefined): { fieldErrors: FieldErrorMap; formError: string | null } {
  if (!fields || fields.length === 0) return { fieldErrors: {}, formError: null };

  const out: FieldErrorMap = {};
  let formError: string | null = null;

  for (const err of fields) {
    const rawPath = err.path || '';
    const key = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;

    if (
      key === 'kind'
      || key === 'name'
      || key === 'host'
      || key === 'port'
      || key === 'username'
      || key === 'password'
      || key === 'database'
      || key === 'sslMode'
    ) {
      out[key] = err.message || 'Invalid value';
    } else if (!formError && err.message) {
      // AIDEV-NOTE: Some schema errors (e.g. anyOf) have no specific instancePath.
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

function ConnectDataSourceModal({ open, onClose }: Props) {
  const dispatch      = useReduxDispatch();
  const panelRef      = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const [dataSourceId, setDataSourceId] = useState<UUIDv7>(() => generateUUIDv7());
  const [name, setName] = useState<string>('');

  // AIDEV-NOTE: failedImportUri stores the raw URI only when parse fails (for optional reveal).
  // We no longer store the raw URI on success - fields become the source of truth.
  const [failedImportUri   , setFailedImportUri]  = useState<string>('');
  const [uriParseError     , setUriParseError]    = useState<string | null>(null);
  const [revealFailedUri   , setRevealFailedUri]  = useState<boolean>(false);

  const [host         , setHost]                  = useState<string>('');
  const [port         , setPort]                  = useState<string>('');
  const [username     , setUsername]              = useState<string>('');
  const [password     , setPassword]              = useState<string>('');
  const [persistSecret, setPersistSecret]         = useState<boolean>(false);
  const [database     , setDatabase]              = useState<string>('');
  const [sslMode      , setSslMode]               = useState<DbSslMode>('require');

  // AIDEV-NOTE: Track which input mode the user is using.
  const [inputMode, setInputMode]                 = useState<InputMode>('none');

  const [isTesting   , setIsTesting]              = useState<boolean>(false);
  const [isConnecting, setIsConnecting]           = useState<boolean>(false);
  const [testStatus  , setTestStatus]             = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage , setTestMessage]            = useState<string | null>(null);
  const [formError   , setFormError]              = useState<string | null>(null);
  const [fieldErrors , setFieldErrors]            = useState<FieldErrorMap>({});

  const canSubmit = !isTesting && !isConnecting;
  const isTestOk  = testStatus === 'success';


  // AIDEV-NOTE: connectionUriError only shows import parse errors (not field validation errors).
  // Field validation errors are shown inline on each field.
  const connectionUriError = uriParseError;

  // AIDEV-NOTE: Compute preview URI when in params mode
  const previewUri = useMemo(() => {
    if (inputMode !== 'params') return '';
    return buildPreviewUri({ host, port, username, password, database });
  }, [inputMode, host, port, username, password, database]);

  const clearFeedback = useCallback(() => {
    setFormError(null);
    setFieldErrors({});
    setTestStatus('idle');
    setTestMessage(null);
  }, []);

  const wipeSecrets = useCallback(() => {
    // AIDEV-NOTE: Treat connection materials as sensitive; wipe on close/success.
    setPassword('');
    setFailedImportUri('');
    setUriParseError(null);
    setRevealFailedUri(false);
  }, []);

  const resetForm = useCallback(() => {
    setDataSourceId(generateUUIDv7());
    setName('');
    setFailedImportUri('');
    setUriParseError(null);
    setRevealFailedUri(false);
    setHost('');
    setPort('');
    setUsername('');
    setPassword('');
    setPersistSecret(false);
    setDatabase('');
    setSslMode('require');
    setInputMode('none');
    clearFeedback();
  }, [clearFeedback]);

  // AIDEV-NOTE: Handle paste event for connection URI import.
  // After paste, we always switch to params mode (URI field becomes readOnly preview).
  // On success: populate fields, clear error, don't store raw URI.
  // On failure: set error, store raw URI for optional reveal, keep existing field values.
  const handleConnectionUriPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    // Prevent default so we can handle the full paste
    e.preventDefault();

    // Always switch to params mode after paste (URI field shows preview, becomes readOnly)
    setInputMode('params');
    setRevealFailedUri(false);

    // Parse and populate fields
    const parsed = parsePostgresUri(pastedText);
    if (parsed) {
      // Success: populate fields, clear error, don't store raw URI
      setUriParseError(null);
      setFailedImportUri('');
      setHost(parsed.host ?? '');
      setPort(typeof parsed.port === 'number' ? String(parsed.port) : '');
      setUsername(parsed.username ?? '');
      setPassword(parsed.password ?? '');
      setDatabase(parsed.database ?? '');
      return;
    }

    // Failure: set error, store raw for reveal toggle, keep existing field values
    setUriParseError('Could not import connection string. Use fields below or reveal to troubleshoot.');
    setFailedImportUri(pastedText);
  }, []);

  // AIDEV-NOTE: Handle individual param changes - switch to params mode and clear import errors.
  const handleParamChange = useCallback((
    setter: (value: string) => void,
    value: string
  ) => {
    setter(value);

    // Clear any import error when user edits params (they're taking over manually)
    if (uriParseError) {
      setUriParseError(null);
      setFailedImportUri('');
      setRevealFailedUri(false);
    }

    // If user starts typing in params, switch to params mode
    if (inputMode !== 'params' && value.trim()) {
      setInputMode('params');
    }
  }, [inputMode, uriParseError]);

  // AIDEV-NOTE: Clear failed import state and allow user to paste again.
  const handleClearAndPasteAgain = useCallback(() => {
    setFailedImportUri('');
    setUriParseError(null);
    setRevealFailedUri(false);
    setInputMode('none');
    // Focus will be handled by the input's autoFocus or user interaction
  }, []);

  // AIDEV-NOTE: Build draft always uses the individual field values (params are source of truth).
  // After paste, fields are populated, so we no longer need separate URI-mode logic.
  const buildDraft = useCallback((): PostgresDataSourceDraft => {
    const draft: PostgresDataSourceDraft = {
      dataSourceId  : dataSourceId,
      kind          : DATA_SOURCE_KIND,
      name          : name,
      sslMode       : sslMode,
      persistSecret : persistSecret
    };

    const hostVal = normalizeString(host);
    const userVal = normalizeString(username);
    const passVal = normalizeString(password);
    const dbVal   = normalizeString(database);

    const portNum = (() => {
      const raw = (port || '').trim();
      if (!raw) return undefined;
      if (!/^[0-9]{1,5}$/.test(raw)) return Number.NaN;
      const parsedPort = Number.parseInt(raw, 10);
      return Number.isFinite(parsedPort) ? parsedPort : Number.NaN;
    })();

    if (hostVal) draft.host = hostVal;
    if (typeof portNum === 'number') draft.port = portNum;
    if (userVal) draft.username = userVal;
    if (passVal) draft.password = passVal;
    if (dbVal)   draft.database = dbVal;

    return draft;
  }, [dataSourceId, database, host, name, password, persistSecret, port, sslMode, username]);

  const applyValidationErrors = useCallback((errors: FieldError[] | undefined) => {
    const mapped = mapFieldErrors(errors);
    setFieldErrors(mapped.fieldErrors);
    setFormError(mapped.formError);
  }, []);

  const validateForTest = useCallback((): PostgresDataSourceTestPayload | null => {
    const draft = buildDraft();
    const res = validateDataSourceDraftForTest(draft);
    if (res.ok) {
      setFieldErrors({});
      setFormError(null);
      return res.data;
    }
    applyValidationErrors(res.errors);
    return null;
  }, [applyValidationErrors, buildDraft]);

  const validateForCreate = useCallback((): DataSource | null => {
    const draft = buildDraft();
    const res = validateDataSourceDraftForCreate(draft);
    if (res.ok) {
      setFieldErrors({});
      setFormError(null);
      return res.data;
    }
    applyValidationErrors(res.errors);
    return null;
  }, [applyValidationErrors, buildDraft]);

  const focusFirst = useCallback(() => {
    const el = firstInputRef.current;
    if (el) {
      try { el.focus(); } catch {}
      return;
    }

    const panel = panelRef.current;
    if (!panel) return;
    const focusables = getFocusableElements(panel);
    const first = focusables[0];
    try { first?.focus?.(); } catch {}
  }, []);

  const focusLast = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = getFocusableElements(panel);
    const last = focusables[focusables.length - 1];
    try { last?.focus?.(); } catch {}
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    clearFeedback();
    setIsTesting(false);
    setIsConnecting(false);

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
  }, [open, clearFeedback, focusFirst, resetForm]);

  const handleOverlayMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  const runTest = useCallback(async () => {
    if (!canSubmit) return;

    clearFeedback();
    setIsTesting(true);
    setTestStatus('idle');

    const payload = validateForTest();
    if (!payload) {
      setIsTesting(false);
      return;
    }

    try {
      const res = await testDataSourceAction(payload);
      if (!res.success) {
        const mapped = mapFieldErrors(res.error.fields);
        setFieldErrors(mapped.fieldErrors);
        setFormError(mapped.formError || res.error.message || 'Failed to test connection.');
        setTestStatus('error');
        setTestMessage(res.error.message || 'Failed to test connection.');
        return;
      }

      setTestStatus('success');
      const latency = typeof res.data?.latencyMs === 'number' ? res.data.latencyMs : null;
      setTestMessage(latency !== null ? `Connection OK (${latency}ms)` : 'Connection OK');
    } catch {
      setTestStatus('error');
      setTestMessage('Failed to test connection.');
    } finally {
      setIsTesting(false);
    }
  }, [canSubmit, clearFeedback, validateForTest]);

  const createDataSource = useCallback(async () => {
    if (!canSubmit) return;

    clearFeedback();
    setIsConnecting(true);

    const payload = validateForCreate();
    if (!payload) {
      setIsConnecting(false);
      return;
    }

    try {
      const res = await createDataSourceAction(payload);
      if (!res.success) {
        const mapped = mapFieldErrors(res.error.fields);
        setFieldErrors(mapped.fieldErrors);
        setFormError(mapped.formError || res.error.message || 'Failed to connect.');
        return;
      }

      const dataSource = res.data;
      dispatch(upsertDataSourceFromFetch({ dataSource }));

      wipeSecrets();
      onClose();
    } catch {
      setFormError('Failed to connect.');
    } finally {
      setIsConnecting(false);
    }
  }, [canSubmit, clearFeedback, dispatch, onClose, validateForCreate, wipeSecrets]);

  const modeLabel = useMemo(() => {
    if (inputMode === 'uri') return 'Using connection string';
    if (inputMode === 'params') return 'Using host/port/user/password';
    return 'Enter connection details';
  }, [inputMode]);

  // AIDEV-NOTE: Compute CSS classes for dimmed state
  const uriInputClassName = useMemo(() => {
    const base = connectionUriError
      ? `${styles['input']} ${styles['input-error']}`
      : styles['input'];
    return inputMode === 'params' ? `${base} ${styles['input-dimmed']}` : base;
  }, [connectionUriError, inputMode]);

  // AIDEV-NOTE: Params fields are always editable now (no dimming in uri mode).
  const paramsFieldClassName = useCallback((hasError: boolean) => {
    return hasError
      ? `${styles['input']} ${styles['input-error']}`
      : styles['input'];
  }, []);

  if (!open) return null;

  return (
    <FloatingPortal>
      <div className={styles['overlay']} onMouseDown={handleOverlayMouseDown}>
        <div
          className={styles['modal']}
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-postgres-title"
          onKeyDown={handleKeyDown}
          ref={panelRef}
        >
          <div tabIndex={0} data-focus-guard="true" onFocus={focusLast} aria-hidden="true" />
          <header className={styles['header']}>
            <h2 id="connect-postgres-title" className={styles['title']}>Database Connection</h2>
            <div className={styles['subtitle']}>{modeLabel}</div>
          </header>

          <div className={styles['body']}>
            {formError && (
              <div className={styles['form-error']} role="alert">
                {formError}
              </div>
            )}

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="connection-name">Connection name</label>
              <input
                id="connection-name"
                ref={firstInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. book store database"
                aria-invalid={fieldErrors.name ? true : undefined}
              />
              {fieldErrors.name && <div className={styles['field-error']}>{fieldErrors.name}</div>}
            </div>

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-connection-uri">Connection string</label>
              <input
                id="db-connection-uri"
                className={uriInputClassName}
                value={inputMode === 'params' ? previewUri : ''}
                onPaste={handleConnectionUriPaste}
                placeholder="Paste postgresql://user:password@host:5432/db"
                aria-invalid={connectionUriError ? true : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                readOnly
              />
              {connectionUriError && <div className={styles['field-error']}>{connectionUriError}</div>}

              {/* AIDEV-NOTE: Show reveal toggle and CTA only when import failed */}
              {uriParseError && failedImportUri && (
                <div className={styles['import-actions']}>
                  <button
                    type="button"
                    className={styles['reveal-button']}
                    onClick={() => setRevealFailedUri((prev) => !prev)}
                  >
                    {revealFailedUri ? 'Hide connection string' : 'Reveal connection string'}
                  </button>
                  <button
                    type="button"
                    className={styles['clear-paste-button']}
                    onClick={handleClearAndPasteAgain}
                  >
                    Clear & paste again
                  </button>
                </div>
              )}

              {/* AIDEV-NOTE: Revealed raw URI textarea (only when user opts in after parse failure) */}
              {revealFailedUri && failedImportUri && (
                <textarea
                  className={styles['revealed-uri']}
                  value={failedImportUri}
                  readOnly
                  rows={3}
                  spellCheck={false}
                  aria-label="Raw connection string (revealed)"
                />
              )}

              {inputMode === 'params' && !uriParseError && (
                <div className={styles['mode-hint']}>Fields populated. Edit below or paste a new connection string.</div>
              )}
            </div>

            <div className={styles['separator']}>
              <span className={styles['separator-text']}>or enter details manually</span>
            </div>

            <div className={styles['row-2']}>
              <div className={styles['field']}>
                <label className={styles['label']} htmlFor="db-host">Host</label>
                <input
                  id="db-host"
                  className={paramsFieldClassName(!!fieldErrors.host)}
                  value={host}
                  onChange={(e) => handleParamChange(setHost, e.target.value)}
                  placeholder="127.0.0.1"
                  aria-invalid={fieldErrors.host ? true : undefined}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {fieldErrors.host && <div className={styles['field-error']}>{fieldErrors.host}</div>}
              </div>

              <div className={styles['field']}>
                <label className={styles['label']} htmlFor="db-port">Port</label>
                <input
                  id="db-port"
                  className={paramsFieldClassName(!!fieldErrors.port)}
                  value={port}
                  onChange={(e) => handleParamChange(setPort, e.target.value)}
                  placeholder="5432"
                  inputMode="numeric"
                  aria-invalid={fieldErrors.port ? true : undefined}
                />
                {fieldErrors.port && <div className={styles['field-error']}>{fieldErrors.port}</div>}
              </div>
            </div>

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-username">User</label>
              <input
                id="db-username"
                className={paramsFieldClassName(!!fieldErrors.username)}
                value={username}
                onChange={(e) => handleParamChange(setUsername, e.target.value)}
                placeholder="postgres"
                aria-invalid={fieldErrors.username ? true : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {fieldErrors.username && <div className={styles['field-error']}>{fieldErrors.username}</div>}
            </div>

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-password">Password</label>
              <input
                id="db-password"
                className={paramsFieldClassName(!!fieldErrors.password)}
                type="password"
                value={password}
                onChange={(e) => handleParamChange(setPassword, e.target.value)}
                placeholder="Enter password"
                aria-invalid={fieldErrors.password ? true : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <label className={styles['persist-row']}>
                <input
                  type="checkbox"
                  className={styles['persist-checkbox']}
                  checked={persistSecret}
                  onChange={(e) => setPersistSecret(e.target.checked)}
                />
                <span className={styles['persist-label']}>Save password</span>
              </label>
              <div className={styles['persist-help']}>
                Store encrypted on the backend so you can reconnect later.
              </div>
              {fieldErrors.password && <div className={styles['field-error']}>{fieldErrors.password}</div>}
            </div>

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-name">Database name</label>
              <input
                id="db-name"
                className={paramsFieldClassName(!!fieldErrors.database)}
                value={database}
                onChange={(e) => handleParamChange(setDatabase, e.target.value)}
                placeholder="postgres"
                aria-invalid={fieldErrors.database ? true : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {fieldErrors.database && <div className={styles['field-error']}>{fieldErrors.database}</div>}
            </div>

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-ssl-mode">TLS mode</label>
              <select
                id="db-ssl-mode"
                value={sslMode}
                onChange={(e) => setSslMode(e.target.value as DbSslMode)}
                aria-invalid={fieldErrors.sslMode ? true : undefined}
              >
                {SSL_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {fieldErrors.sslMode && <div className={styles['field-error']}>{fieldErrors.sslMode}</div>}
            </div>

            {testStatus !== 'idle' && testMessage && (
              <div
                className={isTestOk ? styles['test-ok'] : styles['test-bad']}
                role="status"
              >
                {testMessage}
              </div>
            )}
          </div>

          <footer className={styles['footer']}>
            <button
              type="button"
              className={styles['clear-button']}
              onClick={resetForm}
              disabled={!canSubmit}
            >
              Clear All
            </button>

            <div className={styles['footer-spacer']} />

            <button
              type="button"
              className={styles['test-button']}
              onClick={runTest}
              disabled={!canSubmit}
              aria-busy={isTesting}
            >
              {isTesting ? 'Testing…' : 'Test'}
            </button>

            <button
              type="button"
              className={styles['connect-button']}
              onClick={createDataSource}
              disabled={!canSubmit}
              aria-busy={isConnecting}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>

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
          </footer>
          <div tabIndex={0} data-focus-guard="true" onFocus={focusFirst} aria-hidden="true" />
        </div>
      </div>
    </FloatingPortal>
  );
}


export default ConnectDataSourceModal;
