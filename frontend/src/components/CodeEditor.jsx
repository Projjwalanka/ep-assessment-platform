import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { EditorView } from '@codemirror/view';

const theme = EditorView.theme({
  '&': { backgroundColor: '#FBFCFB' },
  '.cm-gutters': { backgroundColor: '#F1F4F2', color: '#8A9895', border: 'none' },
  '.cm-activeLine': { backgroundColor: '#EEF5F3' },
  '.cm-activeLineGutter': { backgroundColor: '#E3EFEC' },
});

const extensions = [java(), theme, EditorView.lineWrapping];

export default function CodeEditor({ value, onChange, height = '320px', readOnly = false }) {
  return (
    <CodeMirror
      value={value || ''}
      height={height}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      basicSetup={{ foldGutter: false, highlightActiveLine: !readOnly, autocompletion: true, tabSize: 4 }}
      indentWithTab
    />
  );
}
