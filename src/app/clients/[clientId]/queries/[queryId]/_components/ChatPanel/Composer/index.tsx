'use client';

import type { FormEvent }               from 'react';

import { useMemo, useRef, useState }    from 'react';
import CodeMirror                       from '@uiw/react-codemirror';
import { createTheme }                  from '@uiw/codemirror-themes';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, Prec }            from '@codemirror/state';
import { defaultKeymap }                from '@codemirror/commands';

import Icon                             from '@Components/Icons';
import TagTabs                          from '../TagTabs';
import ModelSelect                      from '../ModelSelect';
import styles                           from './styles.module.css';

// AIDEV-NOTE: Align with SQLEditor/JSONEditor: structural theme via EditorView.theme,
// color theme via createTheme for future customization.
const cmStructuralTheme = EditorView.theme({
  '&': { color: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { padding: '0' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-editor': { border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-8)' },
  '.cm-cursor': { borderLeftColor: 'var(--white)' },
  '.cm-dropCursor': { borderLeftColor: 'var(--white)' },
  '.cm-line': { padding: '0' }
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

/* AIDEV-NOTE: Composer scaffold. CM6 Markdown editor, keymap, and submit
   handling will be implemented in the next task. This file establishes the
   three core rows + hidden footer and wires basic props for later use. */

type ComposerProps = {
  model?: string;
  onModelChange?: (model: string) => void;
  onSend?: (text: string) => void;
  tags?: string[];
  onToggleTag?: (tag: string) => void;
  placement?: 'top' | 'bottom';
};

function Composer({
  model = 'gpt-4o-mini',
  onModelChange,
  onSend,
  tags = [],
  onToggleTag,
  placement = 'top'
}: ComposerProps) {
  const viewRef   = useRef<EditorView | null>(null);
  const [hasText, setHasText] = useState<boolean>(false);

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
      {
        key: 'Enter',
        preventDefault: true,
        run: (view) => {
          const text = view.state.doc.toString().trim();
          if (!text) return true;
          onSend?.(text);
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
          return true;
        }
      },
      {
        key: 'Shift-Enter',
        preventDefault: true,
        run: (view) => {
          view.dispatch(view.state.replaceSelection('\n'));
          return true;
        }
      }
    ]));

    return [
      EditorState.readOnly.of(false),
      EditorView.lineWrapping,
      placeholder('Ask about your database…'),
      enterMap,
      keymap.of(defaultKeymap),
      cmStructuralTheme
    ];
  }, [onSend]);

  return (
    <form className={styles['composer']} data-placement={placement} onSubmit={submit}>
      {/* header: tags */}
      <div className={styles['row-header']}>
        <TagTabs tags={tags} onToggle={onToggleTag} />
      </div>

      {/* editor: CodeMirror 6 minimal Markdown */}
      <div className={styles['row-editor']}>
        <CodeMirror
          className={styles['editor-input']}
          height="100%"
          value={''}
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
          onChange={(val) => { setHasText(val.trim().length > 0); }}
          onCreateEditor={(view) => { viewRef.current = view; }}
        />
      </div>

      {/* controls: model select (left) and send (right) */}
      <div className={styles['row-controls']}>
        <div className={styles['controls-left']}>
          <ModelSelect model={model} onChange={(m) => onModelChange?.(m)} />
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

      {/* footer: hidden for now */}
      <div className={styles['row-footer']} aria-hidden />
    </form>
  );
}

export default Composer;
