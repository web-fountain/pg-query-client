'use client';

import {
  memo, useCallback, useEffect,
  useImperativeHandle, useMemo, useRef
}                                                 from 'react';

import CodeMirror                                 from '@uiw/react-codemirror';
import { sql, PostgreSQL }                        from '@codemirror/lang-sql';
import { EditorView, keymap, ViewPlugin, ViewUpdate, highlightWhitespace } from '@codemirror/view';
import { indentUnit }                             from '@codemirror/language';
import { EditorSelection, Prec, Compartment, Transaction } from '@codemirror/state';
import { lintGutter }                             from '@codemirror/lint';
import { createTheme }                            from '@uiw/codemirror-themes';
import { tags as t }                              from '@lezer/highlight';
import { vim, Vim }                               from '@replit/codemirror-vim';

import { useReduxDispatch }                       from '@Redux/storeHooks';
import { updateDataQueryText }                    from '@Redux/records/dataQuery';
import { useDebouncedCallback }                   from '@Hooks/useDebounce';

import { useSqlRunner }                           from '../../../_providers/SQLRunnerProvider';
import { useSQLValidator }                        from '../../_providers/SQLValidatorProvider';
import { useQueriesRoute }                        from '../../_providers/QueriesRouteProvider';
import styles                                     from './styles.module.css';
import type { UUIDv7 }                            from '@Types/primitives';


export type SQLEditorHandle = {
  runCurrentQuery: () => void;
  getCurrentText: () => string;
  focusEditor: () => void;
};

// AIDEV-NOTE: Centralized Vim configuration so keybindings can be adjusted in one place.
type VimMode = 'normal' | 'insert' | 'visual';

type VimKeybinding = {
  // AIDEV-NOTE: Keys can be declared as a chord array (['j','k']) or a literal Vim key string ('jk').
  keys    : string | string[];
  target  : string;
  mode    : VimMode;
};

const vimConfig: { keybindings: VimKeybinding[] } = {
  keybindings: [
    {
      // AIDEV-NOTE: Map the 'j' then 'k' chord in insert mode to behave like <Esc>.
      keys    : ['j', 'k'],
      target  : '<Esc>',
      mode    : 'insert'
    }
  ]
};

// AIDEV-NOTE: CodeMirror theming via extensions, not CSS module classes. See docs: https://codemirror.net/docs/
// Scrollbar pattern (3 states):
//   1) Idle (not hovered, not editing): track visible, thumb hidden.
//   2) Hover or focus-within: show thumb.
//   3) Actively editing (short linger): show thumb (via .cm-editing class from ViewPlugin).
const cmStructuralTheme = EditorView.theme({
  '&': {
    fontSize: 'var(--space-3_5)',
    fontWeight: 'normal',
    lineHeight: '1.5'
  },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarGutter: 'stable',
    scrollbarWidth: 'thin',
    scrollbarColor: 'transparent var(--scrollbar-track-color-visible)',
  },
  '&:hover .cm-scroller, &:focus-within .cm-scroller, &.cm-editing .cm-scroller': {
    scrollbarColor: 'var(--scrollbar-thumb-color-visible) var(--surface-sql-editor)',
  },
  '.cm-content': {
    lineHeight: '1.5',
    cursor: 'text'
  },
  '.cm-gutters': {
    width: '70px',
    background: 'var(--surface-sql-editor)'
  },
  '.cm-gutter.cm-lineNumbers': {
    width: '44px'
  },
  '.cm-gutter.cm-foldGutter': {
    width: '26px',
    alignItems: 'center',
    opacity: 0,
    transition: 'opacity 0.2s ease-in-out'
  },
  '.cm-gutter.cm-foldGutter:hover': {
    opacity: 1
  },
  '.cm-gutter-lint': {
    // Hide lint gutter for now
    width: '0'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent !important',
    boxSizing: 'border-box',
    outline: '1px solid #28282861'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important'
  },
  '.cm-selected-text-for-edit': {
    backgroundColor: '#262834'
  },
  '.cm-tooltip.cm-tooltip-lint': {
    fontFamily: 'inherit',
    fontSize: 'var(--space-3_5)'
  },
  '.cm-highlightSpace': {
    backgroundImage: 'radial-gradient(circle at 50% 50%, #2e2525 20%, transparent 20%)',
    // backgroundPosition: 'center bottom',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1ch 0.5em'
  }
});

// TODO: Investigate which css variables to use/create to replace hardcoded values
const cmColorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'var(--surface-sql-editor)',
    foreground: 'var(--text-primary)',
    caret: '#aeafad',
    selection: '#3d5a80',
    selectionMatch: '#444444',
    gutterBackground: 'var(--surface-sql-editor)',
    gutterForeground: '#4d4d4c',
    gutterActiveForeground: '#fdfffc',
    fontFamily: 'SF Mono, Monaco, Cascadia Code, Roboto Mono, Consolas, Courier New, monospace'
  },
  styles: [
    { tag: [t.lineComment, t.blockComment, t.comment], color: '#6a9955' },
    { tag: t.name           , color: '#cccccc' },
    { tag: t.typeName       , color: '#569cd6' },
    { tag: t.squareBracket  , color: '#da70d6' },
    { tag: t.punctuation    , color: '#cccccc' },
    { tag: t.keyword        , color: '#569cd6' },
    { tag: t.string         , color: '#ce9178' },
    { tag: t.literal        , color: '#b5cea8' },
    { tag: t.number         , color: '#b5cea8' },
    { tag: t.bool           , color: '#cccccc' },
    { tag: t.null           , color: '#569cd6' },
    { tag: t.operator       , color: '#d4d4d4' },
    { tag: t.brace          , color: 'var(--syntax-brace)' }
  ]
});

// AIDEV-NOTE: Stable command to insert two spaces on Tab. Hoisted to avoid re-allocation.
function insertTwoSpaces(view: EditorView): boolean {
  const result = view.state.changeByRange(range => ({
    changes: { from: range.from, to: range.to, insert: '  ' },
    range: EditorSelection.range(range.from + 2, range.from + 2)
  }));
  view.dispatch(view.state.update(result, { scrollIntoView: true, userEvent: 'input' }));
  return true;
}

// AIDEV-NOTE: Helper to detect direct user edits; used by editing reveal plugin.
function isDirectUserEdit(tr: Transaction): boolean {
  return tr.isUserEvent('input')
    || tr.isUserEvent('input.type')
    || tr.isUserEvent('delete')
    || tr.isUserEvent('paste')
    || tr.isUserEvent('cut');
}

// AIDEV-NOTE: Stop Enter bubbling outside; keep default newline behavior in editor. Hoisted for stability.
const domEnterPassthrough = EditorView.domEventHandlers({
  keydown: (event) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.stopPropagation();
    }
  }
});

// AIDEV-NOTE: Toggle .cm-editing class on real user edits to reveal scrollbar thumb (3-state behavior). Hoisted.
const editingRevealPlugin = ViewPlugin.fromClass(class {
  private timer: number | null = null;
  constructor(readonly view: EditorView) {}
  update(u: ViewUpdate) {
    if (u.focusChanged && !u.view.hasFocus) this.clear();
    if (u.transactions.some(isDirectUserEdit) || (u.docChanged && u.view.hasFocus)) {
      this.bump();
    }
  }
  bump() {
    this.view.dom.classList.add('cm-editing');
    if (this.timer != null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.clear(), 1200);
  }
  clear() {
    if (this.timer != null) window.clearTimeout(this.timer);
    this.timer = null;
    this.view.dom.classList.remove('cm-editing');
  }
  destroy() { this.clear(); }
});

type SQLEditorProps = { onChange?: (value: string) => void; editorRef?: React.Ref<SQLEditorHandle | null>; value?: string; suppressDispatch?: boolean };

function SQLEditorImpl({ onChange, editorRef, value, suppressDispatch }: SQLEditorProps) {
  const { runQuery }        = useSqlRunner();
  const { getLinter }       = useSQLValidator();
  const { dataQueryId }     = useQueriesRoute();
  const dispatch            = useReduxDispatch();
  const editorContainerRef  = useRef<HTMLDivElement | null>(null);

  // AIDEV-NOTE: Uncontrolled model — keep latest value and view in refs to avoid React re-renders while typing.
  const editorViewRef = useRef<EditorView | null>(null);
  const latestTextRef = useRef<string>(value || '');
  const submitRef     = useRef<() => void>(() => {});

  // AIDEV-NOTE: Compartments hoisted to refs so we can reconfigure without rebuilding the extension pipeline.
  const themeCompartmentRef  = useRef(new Compartment());
  const wrapCompartmentRef   = useRef(new Compartment());
  const indentCompartmentRef = useRef(new Compartment());
  const lintCompartmentRef   = useRef(new Compartment());
  const keymapCompartmentRef = useRef(new Compartment());

  // AIDEV-NOTE: Build the CM6 extension pipeline once.
  const extensions = useMemo(() => {
    return [
      sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
      indentCompartmentRef.current.of(indentUnit.of('  ')),
      wrapCompartmentRef.current.of(EditorView.lineWrapping),
      highlightWhitespace(),
      lintGutter(),
      lintCompartmentRef.current.of([]),
      vim(),
      keymapCompartmentRef.current.of(
        Prec.highest(
          keymap.of([
            { key: 'Tab', run: insertTwoSpaces },
            { key: 'Mod-Enter', run: () => { submitRef.current(); return true; } }
          ])
        )
      ),
      domEnterPassthrough,
      themeCompartmentRef.current.of(cmStructuralTheme),
      editingRevealPlugin
    ];
  }, []);

  // AIDEV-NOTE: Apply centralized Vim keybindings (e.g. 'j' then 'k' → <Esc> in insert mode).
  useEffect(() => {
    const applied: VimKeybinding[] = [];

    try {
      vimConfig.keybindings.forEach((binding) => {
        const keys = Array.isArray(binding.keys) ? binding.keys.join('') : binding.keys;
        Vim.map(keys, binding.target, binding.mode);
        applied.push(binding);
      });
    } catch {
      // no-op
    }

    return () => {
      try {
        applied.forEach((binding) => {
          const keys = Array.isArray(binding.keys) ? binding.keys.join('') : binding.keys;
          Vim.unmap(keys, binding.mode);
        });
      } catch {
        // no-op
      }
    };
  }, []);

  // AIDEV-NOTE: Stable submit that reads from refs; decoupled from React state.
  const triggerSubmit = useCallback(() => {
    submitRef.current();
  }, []);

  useEffect(() => {
    // AIDEV-NOTE: Do not trim SQL on run; preserve leading/trailing whitespace/newlines.
    submitRef.current = () => {
      const text = latestTextRef.current ?? '';
      if (text.trim().length === 0) return;
      void runQuery(text);
    };
  }, [runQuery]);

  // AIDEV-NOTE: Keep React out of the typing loop; only update latest ref.
  const handleChange = useCallback((next: string) => {
    latestTextRef.current = next;
    try { onChange?.(next); } catch {}
  }, [onChange]);

  // AIDEV-NOTE: Debounced write to Redux (200ms). Track the last sent text
  // and whether a debounced write is currently pending per dataQueryId so we
  // can avoid redundant dispatches on tab/tree selection and still flush
  // unsent edits on unmount.
  const lastSentByIdRef = useRef<Record<string, string>>({});
  const pendingByIdRef  = useRef<Record<string, boolean>>({});

  const debouncedWrite = useDebouncedCallback((id: UUIDv7, text: string) => {
    dispatch(updateDataQueryText({ dataQueryId: id, queryText: text }));
    lastSentByIdRef.current[id] = text;
    pendingByIdRef.current[id] = false;
  }, 200);

  useEffect(() => {
    return () => {
      const latest = latestTextRef.current || '';
      const key = dataQueryId as UUIDv7;

      // AIDEV-NOTE: Only flush if there is a pending debounced write for this
      // id. This prevents spurious updateDataQueryText actions when the user is
      // only changing selection (tabs or tree) and there is no unsent edit.
      if (pendingByIdRef.current[key]) {
        try { debouncedWrite.flush(key, latest); } catch {}
        pendingByIdRef.current[key] = false;
      }

      try { debouncedWrite.cancel(); } catch {}
    };
  }, [debouncedWrite, dataQueryId]);

  // AIDEV-NOTE: Capture the EditorView instance once created.
  const handleCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
    // Initialize latest text ref; CodeMirror will receive `value` via controlled prop.
    latestTextRef.current = value || '';
    // AIDEV-NOTE: Initialize dispatch caches so we avoid a first unmount flush
    // when nothing has changed for this dataQueryId.
    try {
      const key = dataQueryId as UUIDv7;
      lastSentByIdRef.current[key] = value || '';
      pendingByIdRef.current[key] = false;
    } catch {}
  }, [value, dataQueryId]);

  // AIDEV-NOTE: Reconfigure linter extension without rebuilding the pipeline.
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const linter = getLinter({ mode: 'syntax' });
    view.dispatch({ effects: lintCompartmentRef.current.reconfigure(linter) });
  }, [getLinter]);

  // AIDEV-NOTE: Expose a minimal handle so external toolbars can trigger execution.
  useEffect(() => {
    if (!editorRef) return;
    const handle: SQLEditorHandle = {
      runCurrentQuery: triggerSubmit,
      getCurrentText: () => latestTextRef.current || '',
      focusEditor: () => {
        try {
          editorViewRef.current?.focus();
        } catch {
          // no-op
        }
      }
    };
    if (typeof editorRef === 'function') {
      editorRef(handle);
      return () => { try { editorRef(null); } catch {} };
    }
    try {
      const objRef = editorRef as { current: SQLEditorHandle | null };
      objRef.current = handle;
      return () => { try { objRef.current = null; } catch {} };
    } catch {
      // no-op
    }
    return undefined;
  }, [editorRef, triggerSubmit]);

  return (
    <div className={styles['sql-editor']}>
      <div className={styles['editor-container']} ref={editorContainerRef}>
        {/* AIDEV-NOTE: CodeMirror-based editor. Enter inserts newline; Mod-Enter runs query. */}
        <CodeMirror
          className={styles['editor']}
          height="100%"
          theme={cmColorTheme}
          value={value || ''}
          basicSetup={useMemo(() => ({
            bracketMatching: true,
            closeBrackets: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            lineNumbers: true
          }), [])}
          extensions={extensions}
          onCreateEditor={handleCreateEditor}
          onChange={(next) => {
            handleChange(next);
            if (!suppressDispatch) {
              const key = dataQueryId as UUIDv7;
              if (lastSentByIdRef.current[key] !== next) {
                // AIDEV-NOTE: Mark a pending debounced write so unmount can
                // decide whether a flush is required to capture the latest
                // unsent edits.
                pendingByIdRef.current[key] = true;
                try { debouncedWrite(key, next); } catch {}
              }
            }
          }}
        />
      </div>
    </div>
  );
}


export default memo(SQLEditorImpl);
