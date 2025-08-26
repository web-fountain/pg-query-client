'use client';

import { memo, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import { EditorView, keymap } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { Compartment, EditorSelection, Prec } from '@codemirror/state';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';

import styles from './styles.module.css';


type JSONEditorProps = {
  value: unknown;
  className?: string;
};

// AIDEV-NOTE: Read-only JSON viewer using CodeMirror 6. Mirrors SQLEditor theming where sensible.
const _cmStructuralTheme = EditorView.theme({
  '&': {
    fontSize: 'var(--space-3_5)',
    fontWeight: 'normal',
    lineHeight: '1.5'
  },
  '.cm-scroller': {
    overflow: 'auto',
    scrollbarGutter: 'stable',
    scrollbarWidth: 'thin',
    scrollbarColor: 'transparent var(--scrollbar-track-color-visible)'
  },
  '&:hover .cm-scroller, &:focus-within .cm-scroller': {
    scrollbarColor: 'var(--scrollbar-thumb-color-visible) var(--surface-sql-editor)'
  },
  '.cm-content': {
    lineHeight: '1.5',
    cursor: 'text'
  },
  '.cm-gutters': {
    width: '44px',
    background: 'var(--surface-sql-editor)'
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent !important'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important'
  }
});

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
    { tag: t.string, color: '#ce9178' },
    { tag: t.string, color: '#ce9178' },
    { tag: t.number, color: '#b5cea8' },
    { tag: t.bool, color: '#cccccc' },
    { tag: t.null, color: '#569cd6' },
    { tag: t.brace, color: 'var(--syntax-brace)' }
  ]
});

function insertTwoSpaces(view: EditorView): boolean {
  const result = view.state.changeByRange(range => ({
    changes: { from: range.from, to: range.to, insert: '  ' },
    range: EditorSelection.range(range.from + 2, range.from + 2)
  }));
  view.dispatch(view.state.update(result, { scrollIntoView: true, userEvent: 'input' }));
  return true;
}

function JSONEditor({ value, className }: JSONEditorProps) {
  const text = useMemo(() => {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    } catch {
      return '"AIDEV-NOTE: Unable to stringify JSON value."';
    }
  }, [value]);

  const indentCompartment = useMemo(() => new Compartment(), []);

  const extensions = useMemo(() => {
    return [
      jsonLang(),
      indentCompartment.of(indentUnit.of('  ')),
      Prec.highest(keymap.of([{ key: 'Tab', run: insertTwoSpaces }])),
      cmStructuralTheme
    ];
  }, [indentCompartment]);

  return (
    <div className={`${styles['json-editor']} ${className || ''}`.trim()}>
      <CodeMirror
        className={styles['editor']}
        height="100%"
        theme={cmColorTheme}
        basicSetup={{
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          lineNumbers: true
        }}
        value={text}
        extensions={extensions}
        editable={false}
        readOnly={true}
      />
    </div>
  );
}


export default memo(JSONEditor);
