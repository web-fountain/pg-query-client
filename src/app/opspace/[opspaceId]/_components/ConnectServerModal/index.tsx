'use client';

import type {
  ChangeEvent,
  ClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent    as ReactMouseEvent
}                                   from 'react';
import type {
  DataSourceDraft,
  DataSourceKind,
  DbSslMode
}                                   from '@Redux/records/dataSource/types';
import type { FieldError }          from '@Errors/fieldError';

import {
  useCallback, useEffect,
  useMemo, useRef,
  useState
}                                   from 'react';
import { FloatingPortal }           from '@floating-ui/react';

import { useReduxDispatch }         from '@Redux/storeHooks';
import {
  setActiveDataSourceId,
  upsertDataSourceFromFetch
}                                   from '@Redux/records/dataSource';
import { validateDataSourceDraft }  from '@Redux/records/dataSource/validation';
import {
  createDataSourceAction,
  setActiveDataSourceAction,
  testDataSourceAction
}                                   from '@OpSpaceDataSourceActions';

import styles                       from './styles.module.css';


type Props = {
  open: boolean;
  onClose: () => void;
};

type FieldErrorMap = Partial<Record<
  | 'kind'
  | 'serverGroupName'
  | 'dataSourceUri'
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

const DATA_SOURCE_KIND: DataSourceKind = 'postgres';

const SSL_MODE_OPTIONS: Array<{ value: DbSslMode; label: string }> = [
  { value: 'disable'    , label: 'disable'     },
  { value: 'prefer'     , label: 'prefer'      },
  { value: 'require'    , label: 'require'     },
  { value: 'verify-ca'  , label: 'verify-ca'   },
  { value: 'verify-full', label: 'verify-full' }
];

const MAX_PASSWORD_MASK_LENGTH = 8;
// AIDEV-NOTE: Generate dynamic password mask - 1 bullet per character, max 8.
function getPasswordMask(passwordLength: number): string {
  if (passwordLength <= 0) return '';
  const maskLength = Math.min(passwordLength, MAX_PASSWORD_MASK_LENGTH);
  return '•'.repeat(maskLength);
}

// AIDEV-NOTE: Parse a postgres:// or postgresql:// URI and extract connection params.
// Returns undefined if the URI is not parseable.
function parsePostgresUri(uri: string): ParsedUri | undefined {
  if (!uri) return undefined;

  const trimmed = uri.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return undefined;
  }

  try {
    // Replace postgres:// with http:// so URL constructor can parse it
    const normalized  = trimmed.replace(/^postgres(ql)?:\/\//, 'http://');
    const url         = new URL(normalized);

    const host        = url.hostname || undefined;
    const portStr     = url.port;
    const port        = portStr      ? Number.parseInt(portStr, 10)     : undefined;
    const username    = url.username ? decodeURIComponent(url.username) : undefined;
    const password    = url.password ? decodeURIComponent(url.password) : undefined;
    const database    = url.pathname ? url.pathname.replace(/^\//, '')  : undefined;

    return {
      host      : host || undefined,
      port      : Number.isFinite(port) ? port : undefined,
      username  : username || undefined,
      password  : password || undefined,
      database  : database || undefined
    };
  } catch {
    return undefined;
  }
}

// AIDEV-NOTE: Mask the password portion of a connection URI for display.
// e.g., postgresql://user:secret@host:5432/db → postgresql://user:••••••@host:5432/db (6 chars = 6 bullets)
function maskPasswordInUri(uri: string): string {
  if (!uri) return uri;

  const trimmed = uri.trim();
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return uri;
  }

  try {
    // Extract scheme
    const schemeMatch = trimmed.match(/^(postgres(?:ql)?:\/\/)/);
    if (!schemeMatch) return uri;

    const scheme = schemeMatch[1];
    const rest = trimmed.slice(scheme.length);

    // Find the @ that separates userinfo from host
    const atIndex = rest.indexOf('@');
    if (atIndex === -1) return uri; // No userinfo

    const userinfo = rest.slice(0, atIndex);
    const hostAndPath = rest.slice(atIndex); // includes the @

    // Find : that separates username from password in userinfo
    const colonIndex = userinfo.indexOf(':');
    if (colonIndex === -1) return uri; // No password

    const usernameEncoded = userinfo.slice(0, colonIndex);
    const passwordEncoded = userinfo.slice(colonIndex + 1);

    // AIDEV-NOTE: Decode to get actual password length for dynamic masking
    let passwordLength = passwordEncoded.length;
    try {
      passwordLength = decodeURIComponent(passwordEncoded).length;
    } catch {
      // If decode fails, use encoded length
    }

    const mask = getPasswordMask(passwordLength);
    return `${scheme}${usernameEncoded}:${mask}${hostAndPath}`;
  } catch {
    return uri;
  }
}

// AIDEV-NOTE: Build a preview URI from individual params for display when in params mode.
// Shows placeholders for missing values; password mask grows dynamically per character typed.
function buildPreviewUri(params: {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}): string {
  const { host, port, username, password, database } = params;

  const hostPart = host.trim() || '<host>';
  const portPart = port.trim() || '5432';
  const userPart = username.trim() || '<user>';
  const passPart = password.length > 0 ? getPasswordMask(password.length) : '<password>';
  const dbPart = database.trim() || '<database>';

  return `postgresql://${userPart}:${passPart}@${hostPart}:${portPart}/${dbPart}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
      || key === 'serverGroupName'
      || key === 'dataSourceUri'
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

function ConnectServerModal({ open, onClose }: Props) {
  const dispatch      = useReduxDispatch();
  const panelRef      = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const [serverGroupName, setServerGroupName] = useState<string>('');

  // AIDEV-NOTE: rawConnectionUri stores the actual URI (with real password) for submission.
  // displayConnectionUri stores what we show in the input (with masked password).
  const [rawConnectionUri    , setRawConnectionUri]     = useState<string>('');
  const [displayConnectionUri, setDisplayConnectionUri] = useState<string>('');

  const [host         , setHost]          = useState<string>('');
  const [port         , setPort]          = useState<string>('');
  const [username     , setUsername]      = useState<string>('');
  const [password     , setPassword]      = useState<string>('');
  const [persistSecret, setPersistSecret] = useState<boolean>(false);
  const [database     , setDatabase]      = useState<string>('');
  const [sslMode      , setSslMode]       = useState<DbSslMode>('require');

  // AIDEV-NOTE: Track which input mode the user is using.
  const [inputMode, setInputMode] = useState<InputMode>('none');

  const [isTesting   , setIsTesting]    = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [testStatus  , setTestStatus]   = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage , setTestMessage]  = useState<string | null>(null);
  const [formError   , setFormError]    = useState<string | null>(null);
  const [fieldErrors , setFieldErrors]  = useState<FieldErrorMap>({});

  const canSubmit = !isTesting && !isConnecting;
  const isTestOk = testStatus === 'success';

  // AIDEV-NOTE: Compute preview URI when in params mode
  const previewUri = useMemo(() => {
    if (inputMode !== 'params') return '';
    return buildPreviewUri({ host, port, username, password, database });
  }, [inputMode, host, port, username, password, database]);

  // AIDEV-NOTE: Determine if params have any content (for mode detection)
  const hasParamsContent = useMemo(() => {
    return !!(host.trim() || port.trim() || username.trim() || password.trim() || database.trim());
  }, [host, port, username, password, database]);

  const clearFeedback = useCallback(() => {
    setFormError(null);
    setFieldErrors({});
    setTestStatus('idle');
    setTestMessage(null);
  }, []);

  const wipeSecrets = useCallback(() => {
    // AIDEV-NOTE: Treat connection materials as sensitive; wipe on close/success.
    setPassword('');
    setRawConnectionUri('');
    setDisplayConnectionUri('');
  }, []);

  const resetForm = useCallback(() => {
    setServerGroupName('');
    setRawConnectionUri('');
    setDisplayConnectionUri('');
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

  // AIDEV-NOTE: Handle connection URI paste/change - parse and populate fields
  const handleConnectionUriChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // If user is clearing the field
    if (!value.trim()) {
      setRawConnectionUri('');
      setDisplayConnectionUri('');
      if (!hasParamsContent) {
        setInputMode('none');
      }
      return;
    }

    setRawConnectionUri(value);
    setDisplayConnectionUri(maskPasswordInUri(value));
    setInputMode('uri');

    // Parse and populate fields
    const parsed = parsePostgresUri(value);
    if (parsed) {
      if (parsed.host)     setHost(parsed.host);
      if (parsed.port)     setPort(String(parsed.port));
      if (parsed.username) setUsername(parsed.username);
      if (parsed.password) setPassword(parsed.password);
      if (parsed.database) setDatabase(parsed.database);
    }
  }, [hasParamsContent]);

  // AIDEV-NOTE: Handle paste event specifically to capture full URI before masking
  const handleConnectionUriPaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    // Prevent default so we can handle the full paste
    e.preventDefault();

    setRawConnectionUri(pastedText);
    setDisplayConnectionUri(maskPasswordInUri(pastedText));
    setInputMode('uri');

    // Parse and populate fields
    const parsed = parsePostgresUri(pastedText);
    if (parsed) {
      if (parsed.host)    setHost(parsed.host);
      if (parsed.port)     setPort(String(parsed.port));
      if (parsed.username) setUsername(parsed.username);
      if (parsed.password) setPassword(parsed.password);
      if (parsed.database) setDatabase(parsed.database);
    }
  }, []);

  // AIDEV-NOTE: Handle individual param changes - switch to params mode
  const handleParamChange = useCallback((
    setter: (value: string) => void,
    value: string
  ) => {
    setter(value);

    // If user starts typing in params, switch to params mode and clear URI
    if (inputMode !== 'params' && value.trim()) {
      setInputMode('params');
      setRawConnectionUri('');
      setDisplayConnectionUri('');
    }
  }, [inputMode]);

  const buildBaseDraft = useCallback((): DataSourceDraft => {
    // AIDEV-NOTE: In URI mode, use the raw URI. In params mode, use individual fields.
    const uri = inputMode === 'uri' ? normalizeString(rawConnectionUri) : undefined;
    const hostVal = normalizeString(host);
    const userVal = normalizeString(username);
    const passVal = normalizeString(password);
    const dbVal   = normalizeString(database);

    const portNum = (() => {
      const raw = (port || '').trim();
      if (!raw) return undefined;
      const n = Number(raw);
      if (!Number.isFinite(n)) return undefined;
      return Math.trunc(n);
    })();

    const draft: DataSourceDraft = {
      kind            : DATA_SOURCE_KIND,
      serverGroupName : normalizeString(serverGroupName) || '',
      sslMode         : sslMode
    };

    if (uri) {
      draft.dataSourceUri = uri;
    }

    if (hostVal) draft.host = hostVal;
    if (typeof portNum === 'number') draft.port = portNum;
    if (userVal) draft.username = userVal;
    if (passVal) draft.password = passVal;
    if (dbVal)   draft.database = dbVal;

    return draft;
  }, [inputMode, rawConnectionUri, database, host, password, port, serverGroupName, sslMode, username]);

  const buildTestDraft = useCallback((): DataSourceDraft => {
    const d = buildBaseDraft();
    // AIDEV-NOTE: Do not send persistSecret to /test; keep the payload minimal and compatible.
    delete (d as Record<string, unknown>)['persistSecret'];
    return d;
  }, [buildBaseDraft]);

  const buildCreateDraft = useCallback((): DataSourceDraft => {
    const d = buildBaseDraft();
    d.persistSecret = persistSecret;
    return d;
  }, [buildBaseDraft, persistSecret]);

  const validateDraft = useCallback((draft: DataSourceDraft): boolean => {
    const res = validateDataSourceDraft(draft);
    if (res.ok) {
      setFieldErrors({});
      setFormError(null);
      return true;
    }

    const mapped = mapFieldErrors(res.errors);
    setFieldErrors(mapped.fieldErrors);
    setFormError(mapped.formError);
    return false;
  }, []);

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

    const draft = buildTestDraft();
    if (!validateDraft(draft)) {
      setIsTesting(false);
      return;
    }

    try {
      const res = await testDataSourceAction(draft);
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
  }, [buildTestDraft, canSubmit, clearFeedback, validateDraft]);

  const runConnect = useCallback(async () => {
    if (!canSubmit) return;

    clearFeedback();
    setIsConnecting(true);

    const draft = buildCreateDraft();
    if (!validateDraft(draft)) {
      setIsConnecting(false);
      return;
    }

    try {
      const res = await createDataSourceAction(draft);
      if (!res.success) {
        const mapped = mapFieldErrors(res.error.fields);
        setFieldErrors(mapped.fieldErrors);
        setFormError(mapped.formError || res.error.message || 'Failed to connect.');
        return;
      }

      const dataSource = res.data;
      dispatch(upsertDataSourceFromFetch({ dataSource }));
      dispatch(setActiveDataSourceId({ dataSourceId: dataSource.dataSourceId }));

      // AIDEV-NOTE: Best-effort server-side "active" pointer sync; do not block UX on failure.
      try { await setActiveDataSourceAction(dataSource.dataSourceId); } catch {}

      wipeSecrets();
      onClose();
    } catch {
      setFormError('Failed to connect.');
    } finally {
      setIsConnecting(false);
    }
  }, [buildCreateDraft, canSubmit, clearFeedback, dispatch, onClose, validateDraft, wipeSecrets]);

  const modeLabel = useMemo(() => {
    if (inputMode === 'uri') return 'Using connection string';
    if (inputMode === 'params') return 'Using host/port/user/password';
    return 'Enter connection details';
  }, [inputMode]);

  // AIDEV-NOTE: Compute CSS classes for dimmed state
  const uriInputClassName = useMemo(() => {
    const base = fieldErrors.dataSourceUri
      ? `${styles['input']} ${styles['input-error']}`
      : styles['input'];
    return inputMode === 'params' ? `${base} ${styles['input-dimmed']}` : base;
  }, [fieldErrors.dataSourceUri, inputMode]);

  const paramsFieldClassName = useCallback((hasError: boolean) => {
    const base = hasError
      ? `${styles['input']} ${styles['input-error']}`
      : styles['input'];
    return inputMode === 'uri' ? `${base} ${styles['input-dimmed']}` : base;
  }, [inputMode]);

  if (!open) return null;

  return (
    <FloatingPortal>
      <div className={styles['overlay']} onMouseDown={handleOverlayMouseDown}>
        <div
          className={styles['modal']}
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-server-title"
          onKeyDown={handleKeyDown}
          ref={panelRef}
        >
          <div tabIndex={0} data-focus-guard="true" onFocus={focusLast} aria-hidden="true" />
          <header className={styles['header']}>
            <h2 id="connect-server-title" className={styles['title']}>Connect Server</h2>
            <div className={styles['subtitle']}>{modeLabel}</div>
          </header>

          <div className={styles['body']}>
            {formError && (
              <div className={styles['form-error']} role="alert">
                {formError}
              </div>
            )}

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-server-group-name">Server group name</label>
              <input
                id="db-server-group-name"
                ref={firstInputRef}
                value={serverGroupName}
                onChange={(e) => setServerGroupName(e.target.value)}
                placeholder="Type server group name"
                aria-invalid={fieldErrors.serverGroupName ? true : undefined}
              />
              {fieldErrors.serverGroupName && <div className={styles['field-error']}>{fieldErrors.serverGroupName}</div>}
            </div>

            <div className={styles['field']}>
              <label className={styles['label']} htmlFor="db-connection-uri">Connection string</label>
              <input
                id="db-connection-uri"
                className={uriInputClassName}
                value={inputMode === 'params' ? previewUri : displayConnectionUri}
                onChange={handleConnectionUriChange}
                onPaste={handleConnectionUriPaste}
                placeholder="postgresql://user:password@host:5432/db"
                aria-invalid={fieldErrors.dataSourceUri ? true : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                readOnly={inputMode === 'params'}
              />
              {fieldErrors.dataSourceUri && <div className={styles['field-error']}>{fieldErrors.dataSourceUri}</div>}
              {inputMode === 'params' && (
                <div className={styles['mode-hint']}>Typing in fields below. Clear fields to use connection string.</div>
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
              onClick={runConnect}
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


export default ConnectServerModal;
