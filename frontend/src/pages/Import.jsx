import { useRef, useState } from 'react';
import { CircleAlert, Download, FileUp, Upload } from 'lucide-react';
import { api } from '../api';
import { BANDS, bandLabel, DIFFS, diffLabel, letter } from '../format';
import { Badge, Button, DiffBadge, Field, PageHead, Panel, useUi } from '../ui';

const TEMPLATE = `Question,Option A,Option B,Option C,Option D,Answer,Topic,Level,Difficulty,Explanation
"Which collection keeps keys in insertion order?",HashMap,LinkedHashMap,TreeMap,Hashtable,B,Collections,0-5,Easy,"LinkedHashMap keeps a linked list of entries."
"Which HTTP method is idempotent?",POST,PUT,PATCH,CONNECT,B,REST APIs,6-10,Medium,
`;

const TEXT_SAMPLE = `1. Which annotation marks a Spring Boot entry point?
A) @EnableAutoConfiguration only
B) @SpringBootApplication
C) @Configuration
D) @ComponentScan
Answer: B
Topic: Spring Boot
Level: 0-5
Difficulty: Easy`;

export default function ImportPage() {
  const { toast } = useUi();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [defaults, setDefaults] = useState({ band: '', topic: '', difficulty: 'MEDIUM' });
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const pick = (f) => { if (f) { setFile(f); setPreview(null); setResult(null); } };
  const upload = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(defaults).forEach(([k, v]) => v && fd.append(k, v));
      const p = await api.upload('/admin/questions/import', fd);
      setPreview(p);
      setSelected(p.rows.map((r, i) => (r.errors.length ? null : i)).filter((i) => i != null));
      if (!p.total) toast('No questions were found. Check the format guide below.', 'error');
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/questions/bulk', selected.map((i) => preview.rows[i]));
      setResult(r);
      setPreview(null); setFile(null);
      toast(`${r.saved} questions added to the master bank`);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'examdesk-question-template.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="stack">
      <PageHead title="Import questions" subtitle="Upload Excel, CSV, Word, PDF or text files. You’ll see every question before anything is saved."
        actions={<Button icon={Download} onClick={download}>Download CSV template</Button>} />

      <div className="grid g3">
        <div className="span2 stack">
          <Panel title="Upload">
            <div className="stack">
              <div className={`dropzone ${drag ? 'drag' : ''}`} role="button" tabIndex={0}
                onClick={() => input.current?.click()} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
                <FileUp size={30} strokeWidth={1.5} color="var(--accent)" />
                <div className="mt8"><b>{file ? file.name : 'Drop a file here or click to choose'}</b></div>
                <div className="small muted">{file ? `${(file.size / 1024).toFixed(0)} KB` : '.xlsx, .xls, .csv, .docx, .pdf or .txt, up to 10 MB'}</div>
                <input ref={input} type="file" hidden accept=".xlsx,.xls,.csv,.docx,.pdf,.txt,.md" onChange={(e) => pick(e.target.files?.[0])} />
              </div>
              <div className="small muted">Used when a question doesn’t specify its own value:</div>
              <div className="grid g3">
                <Field label="Default band"><select className="select" value={defaults.band} onChange={(e) => setDefaults({ ...defaults, band: e.target.value })}><option value="">None</option>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select></Field>
                <Field label="Default topic"><input className="input" value={defaults.topic} onChange={(e) => setDefaults({ ...defaults, topic: e.target.value })} placeholder="e.g. Microservices" /></Field>
                <Field label="Default difficulty"><select className="select" value={defaults.difficulty} onChange={(e) => setDefaults({ ...defaults, difficulty: e.target.value })}>{DIFFS.map((d) => <option key={d} value={d}>{diffLabel(d)}</option>)}</select></Field>
              </div>
              <div className="row"><Button variant="primary" icon={Upload} disabled={!file} busy={busy && !preview} onClick={upload}>Read file</Button></div>
            </div>
          </Panel>

          {result && (
            <div className="notice pass">
              <span>{result.saved} questions saved.{result.duplicates ? ` ${result.duplicates} skipped because the same question text already exists.` : ''}{result.errors.length ? ` ${result.errors.length} rows skipped as incomplete.` : ''}</span>
            </div>
          )}

          {preview && (
            <Panel title={`Preview of ${preview.fileName}`} subtitle={`${preview.total} found, ${preview.valid} ready, ${preview.invalid} need fixing in the source file`} pad={false}
              actions={<>
                <Button size="sm" variant="ghost" onClick={() => setSelected(preview.rows.map((r, i) => (r.errors.length ? null : i)).filter((i) => i != null))}>Select all ready</Button>
                <Button variant="primary" busy={busy} disabled={!selected.length} onClick={save}>Save {selected.length} to master bank</Button>
              </>}>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {preview.rows.map((r, i) => (
                  <label key={i} className="q-item" style={{ cursor: r.errors.length ? 'default' : 'pointer', background: r.errors.length ? '#FDF8F7' : undefined }}>
                    <input type="checkbox" disabled={!!r.errors.length} checked={selected.includes(i)} style={{ accentColor: 'var(--accent)', marginTop: 3 }}
                      onChange={() => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))} />
                    <div>
                      <div className="tiny muted">{r.source}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
                      <div className="mt8">
                        {r.options.map((o, j) => <div key={j} className={`opt-line ${j === r.correctIndex ? 'correct' : ''}`} style={{ padding: '3px 8px' }}><span className="opt-key">{letter(j)}</span>{o}</div>)}
                      </div>
                      <div className="q-meta">
                        {r.topic && <Badge>{r.topic}</Badge>}{r.difficulty && <DiffBadge d={r.difficulty} />}{r.band && <Badge>{bandLabel(r.band)}</Badge>}
                        {r.errors.map((e) => <Badge key={e} tone="fail"><CircleAlert size={12} /> {e}</Badge>)}
                      </div>
                    </div>
                    <span />
                  </label>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <Panel title="Format guide">
          <div className="stack small">
            <div>
              <b>Spreadsheets and CSV</b>
              <p className="muted mt8">One question per row with a header row. Recognised columns: Question, Option A–E (or Option 1–5), Answer, Topic, Level (or Band / Experience), Difficulty, Explanation. Word tables with the same headers work too.</p>
            </div>
            <div>
              <b>Answer column</b>
              <p className="muted mt8">A letter (B), a number (2) or the exact option text.</p>
            </div>
            <div>
              <b>Level</b>
              <p className="muted mt8">0-5, 6-10, 10-15 or 15+. Plain numbers such as “7 years” are mapped to the matching band.</p>
            </div>
            <div>
              <b>PDF, Word text and TXT</b>
              <p className="muted mt8">Number each question, put options on their own lines, then an Answer line:</p>
              <pre className="code-view mt8" style={{ fontSize: '0.75rem' }}>{TEXT_SAMPLE}</pre>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
