'use client';

import type { FormEvent }               from 'react';

import { useEffect, useMemo, useRef, useState }   from 'react';
import CodeMirror                       from '@uiw/react-codemirror';
import { createTheme }                  from '@uiw/codemirror-themes';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorSelection, EditorState, Prec } from '@codemirror/state';
import { defaultKeymap }                from '@codemirror/commands';

import Icon                             from '@Components/Icons';
import TagTabs                          from '../TagTabs';
import ModelSelect                      from '../ModelSelect';

import styles                           from './styles.module.css';


const cmStructuralTheme = EditorView.theme({
  '&': { color: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { padding: '0', minHeight: '0' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-editor': { border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-8)', minHeight: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--white)' },
  '.cm-dropCursor': { borderLeftColor: 'var(--white)' },
  '.cm-line': { padding: '0', lineHeight: 'var(--leading-normal)' }
});

const cmColorTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'transparent',
    foreground: 'var(--text-primary)',
    caret: 'var(--white)',
    selection: 'color-mix(in oklch, var(--foreground) 18%, transparent)',
    selectionMatch: 'color-mix(in oklch, var(--foreground) 24%, transparent)',
    fontFamily: 'inherit'
  },
  styles: []
});

type MessageComposerProps = {
  value: string;
  readOnly?: boolean;      // true when collapsed
  collapsed?: boolean;     // collapsed state
  expanded?: boolean;      // expanded state
  onChange?: (text: string) => void; // future: persist edits
  onToggleTag?: (tag: string) => void;
  onModelChange?: (model: string) => void;
  model?: string;
  tags?: string[];
  onSend?: (text: string) => void;
};

function MessageComposer({
  value,
  readOnly = true,
  collapsed = false,
  expanded = false,
  onChange,
  model = 'gpt-5',
  onModelChange,
  onSend,
  tags = [],
  onToggleTag,
}: MessageComposerProps) {
  const viewRef   = useRef<EditorView | null>(null);
  const [hasText, setHasText] = useState<boolean>(Boolean(value && value.trim().length > 0));

  function submit(e?: FormEvent) {
    if (e) e.preventDefault();
    const view = viewRef.current;
    if (!view) return;
    const text = view.state.doc.toString().trim();
    if (!text) return;
    onSend?.(text);
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    setHasText(false);
  }

  // Build extension pipeline once (stable by identity)
  const extensions = useMemo(() => {
    const enterMap = Prec.highest(keymap.of([
      { key: 'Enter', preventDefault: true, run: () => true },
      { key: 'Shift-Enter', preventDefault: true, run: (view) => { view.dispatch(view.state.replaceSelection('\n')); return true; } }
    ]));

    return [
      EditorState.readOnly.of(Boolean(readOnly)),
      EditorView.lineWrapping,
      placeholder(''),
      enterMap,
      keymap.of(defaultKeymap),
      cmStructuralTheme
    ];
  }, [readOnly]);

  // When expanded, focus editor and move caret to end
  useEffect(() => {
    if (!expanded) return;
    const view = viewRef.current; if (!view) return;
    try {
      const end = view.state.doc.length;
      view.focus();
      view.dispatch({ selection: EditorSelection.cursor(end), scrollIntoView: true });
    } catch {}
  }, [expanded]);

  // When collapsing, reset CM scroller to the top so the first lines are visible
  useEffect(() => {
    if (!collapsed) return;
    const view = viewRef.current; if (!view) return;
    try {
      // Prefer the public scrollDOM API in CM6
      (view as any).scrollDOM.scrollTop = 0;
    } catch {
      try {
        const node = (view as any).dom?.querySelector?.('.cm-scroller');
        if (node) (node as HTMLElement).scrollTop = 0;
      } catch {}
    }
  }, [collapsed]);

  function noop(e?: FormEvent) { if (e) e.preventDefault(); }

  return (
    <form
      className={styles['composer']}
      data-placement="top"
      data-collapsed={collapsed || undefined}
      data-expanded={expanded || undefined}
      onSubmit={noop}
    >
      {/* header: tags (visible only when expanded) */}
      {expanded ? (
        <div className={styles['row-header']}>
          <TagTabs tags={tags} onToggle={onToggleTag} />
        </div>
      ) : null}

      {/* editor: CodeMirror 6 minimal Markdown */}
      <div className={styles['row-editor']}>
        <CodeMirror
          className={styles['editor-input']}
          height="100%"
          value={value}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            bracketMatching: false,
            autocompletion: false,
            closeBrackets: false
          }}
          theme={cmColorTheme}
          extensions={extensions}
          onChange={(val) => { setHasText(val.trim().length > 0); onChange?.(val); }}
          onCreateEditor={(view) => { viewRef.current = view; }}
        />
      </div>

      {/* controls: model select (left) and send (right) — only when expanded */}
      {expanded ? (
        <div className={styles['row-controls']}>
          <div className={styles['controls-left']}>
            <ModelSelect model={model} onChange={(m) => onModelChange?.(m)} placement="bottom" />
          </div>
          <div className={styles['controls-right']}>
            <button
              type="submit"
              className={styles['send']}
              aria-label="Send message"
              data-disabled={(!hasText) || undefined}
              onClick={() => submit()}
            >
              {hasText ? (
                <Icon name="arrow-up-circle-solid-with-ring" width={28} height={28} />
              ) : (
                <Icon name="arrow-up" width={28} height={28} />
              )}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}


export default MessageComposer;
