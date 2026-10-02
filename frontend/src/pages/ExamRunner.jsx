import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, CircleX, Flag, Play, RotateCcw, Send } from 'lucide-react';
import { api } from '../api';
import { diffLabel, fmtClock, letter } from '../format';
import { Button, ErrorNote, Loading, Modal, Spinner, useUi } from '../ui';

const CodeEditor = lazy(() => import('../components/CodeEditor'));
const AUTOSAVE_MS = 15000;

export default function ExamRunner() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useUi();
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [code, setCode] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(null);
  const dirty = useRef(false);
  const stateRef = useRef({});
  stateRef.current = { answers, code, flagged, tabSwitches };
  const deadlineRef = useRef(null);

  useEffect(() => {
    api.post(`/candidate/exams/${id}/start`).then((p) => {
      setPaper(p);
      setAnswers(p.saved.answers || {});
      const starter = Object.fromEntries(p.coding.map((c) => [String(c.id), c.starterCode]));
      setCode({ ...starter, ...(p.saved.code || {}) });
      setFlagged(p.saved.flagged || []);
      setTabSwitches(p.saved.tabSwitches || 0);
      if (p.remainingSeconds != null) {
        deadlineRef.current = Date.now() + p.remainingSeconds * 1000;
        setRemaining(p.remainingSeconds);
      }
    }).catch((e) => {
      if (e.status === 409) setFinished({ message: e.message });
      else setError(e);
    });
  }, [id]);

  const items = useMemo(() => {
    if (!paper) return [];
    return [
      ...paper.questions.map((q, i) => ({ kind: 'q', id: q.id, label: String(i + 1), data: q })),
      ...paper.coding.map((c, i) => ({ kind: 'c', id: c.id, label: `H${i + 1}`, data: c })),
    ];
  }, [paper]);

  const save = useCallback(async () => {
    if (!dirty.current || finished) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      const r = await api.put(`/candidate/exams/${id}/progress`, stateRef.current);
      if (r.remainingSeconds != null) deadlineRef.current = Date.now() + r.remainingSeconds * 1000;
      setSaveState('saved');
    } catch (e) {
      if (e.status === 409) { setFinished({ message: e.message, auto: true }); return; }
      dirty.current = true;
      setSaveState('offline');
    }
  }, [id, finished]);

  const submit = useCallback(async (auto = false) => {
    setSubmitting(true);
    try {
      await api.post(`/candidate/exams/${id}/submit`, stateRef.current);
      setFinished({ auto });
    } catch (e) {
      if (e.status === 409) setFinished({ message: e.message, auto: true });
      else toast(e.message, 'error');
    } finally { setSubmitting(false); setConfirmOpen(false); }
  }, [id, toast]);

  // autosave loop
  useEffect(() => {
    if (!paper || finished) return undefined;
    const t = setInterval(save, AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [paper, finished, save]);

  // countdown
  useEffect(() => {
    if (!paper || finished || deadlineRef.current == null) return undefined;
    const t = setInterval(() => {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) { clearInterval(t); submit(true); }
    }, 1000);
    return () => clearInterval(t);
  }, [paper, finished, submit]);

  // tab-switch tracking + save when leaving
  useEffect(() => {
    if (!paper || finished) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        setTabSwitches((n) => n + 1);
        dirty.current = true;
        setTimeout(save, 50);
      }
    };
    const onUnload = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('beforeunload', onUnload); };
  }, [paper, finished, save]);

  const touch = () => { dirty.current = true; setSaveState('unsaved'); };
  const choose = (qid, i) => { setAnswers((a) => ({ ...a, [qid]: i })); touch(); };
  const clear = (qid) => { setAnswers((a) => { const n = { ...a }; delete n[qid]; return n; }); touch(); };
  const toggleFlag = (itemId) => { setFlagged((f) => (f.includes(itemId) ? f.filter((x) => x !== itemId) : [...f, itemId])); touch(); };
  const setCodeFor = (pid, v) => { setCode((c) => ({ ...c, [pid]: v })); touch(); };

  if (finished) return <Finished info={finished} onHome={() => nav('/candidate')} />;
  if (error) return <div className="page"><ErrorNote error={error} /><Button className="mt16" onClick={() => nav('/candidate')}>Back</Button></div>;
  if (!paper) return <Loading text="Preparing your paper…" />;

  const item = items[idx];
  const answeredCount = paper.questions.filter((q) => answers[q.id] != null).length;
  const timerClass = remaining == null ? '' : remaining <= 60 ? 'critical' : remaining <= 300 ? 'low' : '';

  return (
    <div className="exam">
      <div className="exam-bar">
        <div className="title">{paper.title}</div>
        <div className="spacer" />
        <span className="save-state">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All answers saved' : saveState === 'offline' ? 'Offline – will retry' : 'Unsaved changes'}
        </span>
        {remaining != null
          ? <span className={`timer ${timerClass}`} aria-live="off" title="Time remaining">{fmtClock(remaining)}</span>
          : <span className="timer">Untimed</span>}
        <Button variant="primary" icon={Send} onClick={() => { save(); setConfirmOpen(true); }}>Submit</Button>
      </div>

      <div className="exam-body">
        <aside className="navigator">
          <div className="small muted" style={{ marginBottom: 10 }}>{answeredCount} of {paper.questions.length} answered</div>
          {paper.questions.length > 0 && (
            <>
              <div className="small" style={{ fontWeight: 500, marginBottom: 8 }}>Multiple choice</div>
              <div className="nav-grid">
                {items.filter((i) => i.kind === 'q').map((it) => {
                  const n = items.indexOf(it);
                  return (
                    <button key={it.id} className={`nav-cell ${answers[it.id] != null ? 'answered' : ''} ${n === idx ? 'current' : ''} ${flagged.includes(it.id) ? 'flagged' : ''}`}
                      onClick={() => setIdx(n)} aria-label={`Question ${it.label}`}>{it.label}</button>
                  );
                })}
              </div>
            </>
          )}
          {paper.coding.length > 0 && (
            <>
              <div className="small" style={{ fontWeight: 500, margin: '18px 0 8px' }}>Hands-on</div>
              <div className="stack" style={{ gap: 6 }}>
                {items.filter((i) => i.kind === 'c').map((it) => {
                  const n = items.indexOf(it);
                  const changed = code[it.id] && code[it.id] !== it.data.starterCode;
                  return (
                    <button key={it.id} className={`btn sm ${n === idx ? 'primary' : ''}`} style={{ justifyContent: 'flex-start' }} onClick={() => setIdx(n)}>
                      {it.label}: {it.data.title} {changed && n !== idx && <CheckCircle2 size={14} color="var(--accent)" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="nav-legend">
            <span><i style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} />Answered</span>
            <span><i />Not answered</span>
            <span><i style={{ background: 'var(--amber)', borderColor: 'var(--amber)', borderRadius: '50%', width: 8, height: 8 }} />Flagged for review</span>
          </div>
          {tabSwitches > 0 && <div className="notice amber mt16 small"><CircleAlert size={16} />You left this window {tabSwitches} time{tabSwitches > 1 ? 's' : ''}. This is shared with your evaluator.</div>}
        </aside>

        {item?.kind === 'q' && (
          <div className="question-pane">
            <div className="question-card">
              <div className="row between">
                <span className="muted small">Question {item.label} of {paper.questions.length}, {item.data.topic}</span>
                <Button size="sm" variant={flagged.includes(item.id) ? 'primary' : ''} icon={Flag} onClick={() => toggleFlag(item.id)}>
                  {flagged.includes(item.id) ? 'Flagged' : 'Flag for review'}
                </Button>
              </div>
              <div className="q-text">{item.data.text}</div>
              <div role="radiogroup" aria-label="Options">
                {item.data.options.map((o, i) => (
                  <label key={i} className={`option ${answers[item.id] === i ? 'on' : ''}`}>
                    <input type="radio" name={`q${item.id}`} checked={answers[item.id] === i} onChange={() => choose(item.id, i)} />
                    <span className="key">{letter(i)}</span>
                    <span className="txt">{o}</span>
                  </label>
                ))}
              </div>
              <div className="row between mt24">
                <Button icon={ChevronLeft} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</Button>
                {answers[item.id] != null && <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => clear(item.id)}>Clear answer</Button>}
                <Button variant="primary" disabled={idx === items.length - 1} onClick={() => setIdx(idx + 1)}>Next <ChevronRight size={16} /></Button>
              </div>
            </div>
          </div>
        )}

        {item?.kind === 'c' && (
          <CodingTask key={item.id} examId={id} problem={item.data} value={code[item.id] ?? item.data.starterCode}
            onChange={(v) => setCodeFor(item.id, v)} onReset={() => setCodeFor(item.id, item.data.starterCode)}
            onPrev={idx > 0 ? () => setIdx(idx - 1) : null} onNext={idx < items.length - 1 ? () => setIdx(idx + 1) : null} />
        )}
      </div>

      {confirmOpen && (
        <Modal title="Submit your assessment?" onClose={() => setConfirmOpen(false)}
          footer={<>
            <Button onClick={() => setConfirmOpen(false)}>Keep working</Button>
            <Button variant="primary" icon={Send} busy={submitting} onClick={() => submit(false)}>Submit now</Button>
          </>}>
          <div className="stack">
            <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="stat"><div className="stat-value">{answeredCount}/{paper.questions.length}</div><div className="stat-label">Answered</div></div>
              <div className="stat"><div className="stat-value">{flagged.length}</div><div className="stat-label">Flagged</div></div>
              <div className="stat"><div className="stat-value">{paper.coding.filter((c) => code[c.id] && code[c.id] !== c.starterCode).length}/{paper.coding.length}</div><div className="stat-label">Hands-on edited</div></div>
            </div>
            {answeredCount < paper.questions.length && <div className="notice amber"><CircleAlert size={18} />{paper.questions.length - answeredCount} question{paper.questions.length - answeredCount > 1 ? 's are' : ' is'} still unanswered.</div>}
            <p>After submitting you can’t change your answers. Hands-on code is run against all tests, including hidden ones, which can take a moment.</p>
          </div>
        </Modal>
      )}
      {submitting && !confirmOpen && <div className="overlay"><div className="modal" style={{ padding: 30, alignItems: 'center', gap: 12 }}><Spinner /> Submitting and running tests…</div></div>}
    </div>
  );
}

function CodingTask({ examId, problem, value, onChange, onReset, onPrev, onNext }) {
  const { toast, confirm } = useUi();
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try { setResult(await api.post(`/candidate/exams/${examId}/run`, { problemId: problem.id, code: value })); }
    catch (e) { toast(e.message, 'error'); }
    finally { setRunning(false); }
  };

  const reset = async () => {
    if (await confirm({ title: 'Reset to starter code?', message: 'Your changes to this task will be replaced with the original template.', confirmText: 'Reset', danger: true })) onReset();
  };

  return (
    <div className="coding-pane">
      <div className="problem-text">
        <div className="row"><h2>{problem.title}</h2><span className={`badge diff-${problem.difficulty}`}>{diffLabel(problem.difficulty)}</span></div>
        <div className="desc"><RichText text={problem.description} /></div>
        <h3 className="mt16">Sample tests</h3>
        <div className="tests mt8">
          {problem.tests.map((t) => (
            <div key={t.name} className="test-row" style={{ gridTemplateColumns: '1fr' }}>
              <div><b>{t.name}</b><div className="detail">{t.call}</div><div className="detail">expected: {t.expected}</div></div>
            </div>
          ))}
        </div>
        {problem.hiddenCount > 0 && <p className="small muted mt8">Plus {problem.hiddenCount} hidden test{problem.hiddenCount > 1 ? 's' : ''} that run when you submit.</p>}
        <div className="row mt24">
          {onPrev && <Button icon={ChevronLeft} onClick={onPrev}>Previous</Button>}
          {onNext && <Button onClick={onNext}>Next <ChevronRight size={16} /></Button>}
        </div>
      </div>
      <div className="editor-side">
        <div className="editor-tools">
          <span className="small muted">Java 21. Keep the class and method signatures.</span>
          <div className="spacer" />
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={reset}>Reset</Button>
          <Button size="sm" variant="primary" icon={Play} busy={running} onClick={run}>Run tests</Button>
        </div>
        <div className="editor-host">
          <Suspense fallback={<Loading text="Loading editor…" />}>
            <CodeEditor value={value} onChange={onChange} height="100%" />
          </Suspense>
        </div>
        {(result || running) && (
          <div className="results">
            {running ? <div className="row small muted"><Spinner /> Compiling and running sample tests…</div> : <RunResultView result={result} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Plain text with `inline code` spans, as used in problem statements. */
export function RichText({ text }) {
  return (text || '').split(/(`[^`\n]+`)/g).map((part, i) => (part.startsWith('`') && part.endsWith('`') && part.length > 2 ? <code key={i} className="inline-code">{part.slice(1, -1)}</code> : part));
}

export function RunResultView({ result }) {
  if (!result) return null;
  if (!result.compiled) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="row"><CircleX size={18} color="var(--fail)" /><b>{result.error && !result.compileErrors?.includes('error') ? 'Not run' : 'Compilation failed'}</b></div>
        <pre className="code-view" style={{ maxHeight: 220 }}>{result.compileErrors || result.error}</pre>
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row">
        {result.passed === result.total ? <CircleCheck size={18} color="var(--pass)" /> : <CircleAlert size={18} color="var(--amber)" />}
        <b>{result.passed} of {result.total} tests passed</b>
        {result.timedOut && <span className="badge fail">Timed out</span>}
      </div>
      <div className="tests">
        {result.tests.map((t) => (
          <div key={t.name} className="test-row">
            {t.passed ? <CircleCheck size={17} color="var(--pass)" /> : <CircleX size={17} color="var(--fail)" />}
            <div>
              <div>{t.name}{t.hidden && <span className="badge" style={{ marginLeft: 6 }}>hidden</span>}</div>
              {!t.passed && (
                <div className="detail">
                  {t.error ? t.error : <>expected {t.expected}, got {t.actual}</>}
                </div>
              )}
            </div>
            <span className="tiny muted">{t.millis} ms</span>
          </div>
        ))}
      </div>
      {result.console && <><div className="small muted">Console output</div><pre className="code-view" style={{ maxHeight: 160 }}>{result.console}</pre></>}
    </div>
  );
}

function Finished({ info, onHome }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="panel panel-pad" style={{ maxWidth: 520, textAlign: 'center' }}>
        <CheckCircle2 size={44} color="var(--pass)" strokeWidth={1.6} />
        <h1 className="mt16">Assessment submitted</h1>
        <p className="muted mt8">
          {info.message || (info.auto ? 'Time ran out, so your saved answers were submitted automatically.' : 'Thanks for completing the assessment.')}
          {' '}Your evaluator will review the results and get in touch about next steps.
        </p>
        <Button className="mt24" variant="primary" onClick={onHome}>Back to my assessments</Button>
      </div>
    </div>
  );
}
