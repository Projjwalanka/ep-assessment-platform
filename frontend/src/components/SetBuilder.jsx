import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Code2, Lock, PenLine, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { BANDS, bandLabel, diffLabel } from '../format';
import { Badge, Button, DiffBadge, Empty, Field, Loading, Modal, Panel, Segmented, Switch, useLoad, useUi } from '../ui';
import { MixBar } from './Charts';
import QuestionPicker from './QuestionPicker';
import QuestionEditor from './QuestionEditor';

const suggest = (questions, coding) => {
  const m = Math.ceil(questions.length * 1.5) + coding.reduce((s, p) => s + (p.suggestedMinutes || 20), 0);
  return Math.max(10, Math.ceil(m / 5) * 5);
};

/**
 * Builds a paper. mode="set" edits a reusable template; mode="assign" assigns it to a candidate.
 * Sources: an existing set, auto-generation by band/count/topics, or hand-picked and newly written questions.
 */
export default function SetBuilder({ mode, initialSet, candidate, onSaved, onAssigned }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const admin = user.role === 'ADMIN';
  const [meta] = useLoad(() => api.get('/common/meta'));
  const [sets] = useLoad(() => api.get('/common/sets'));
  const [library] = useLoad(() => api.get('/common/coding'));
  const enforce = !admin && !!meta?.settings?.enforceAdminSets;
  const canWrite = admin || (meta?.settings?.allowEvaluatorQuestions && !enforce);
  const readOnlySet = initialSet && initialSet.adminDefined && !admin;

  const [name, setName] = useState(initialSet?.name || '');
  const [description, setDescription] = useState(initialSet?.description || '');
  const [band, setBand] = useState(initialSet?.band || candidate?.band || '0-5');
  const [questions, setQuestions] = useState(initialSet?.questions || []);
  const [coding, setCoding] = useState(initialSet?.coding || []);
  const [timed, setTimed] = useState(initialSet ? initialSet.durationMinutes != null : true);
  const [minutes, setMinutes] = useState(initialSet?.durationMinutes || 45);
  const [minutesTouched, setMinutesTouched] = useState(!!initialSet);
  const [sourceSetId, setSourceSetId] = useState(initialSet?.id && mode === 'assign' ? initialSet.id : null);
  const [modified, setModified] = useState(false);
  const [source, setSource] = useState(mode === 'assign' ? 'set' : (initialSet ? 'manual' : 'generate'));
  const [picker, setPicker] = useState(false);
  const [writer, setWriter] = useState(false);
  const [codingPicker, setCodingPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => { if (enforce) setSource('set'); }, [enforce]);
  useEffect(() => { if (!minutesTouched) setMinutes(suggest(questions, coding)); }, [questions, coding, minutesTouched]);

  const change = (fn) => { fn(); setModified(true); };
  const mix = useMemo(() => questions.reduce((m, q) => ({ ...m, [q.difficulty]: (m[q.difficulty] || 0) + 1 }), {}), [questions]);
  const topicMix = useMemo(() => Object.entries(questions.reduce((m, q) => ({ ...m, [q.topic]: (m[q.topic] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]), [questions]);
  const visibleSets = (sets || []).filter((s) => (enforce ? s.adminDefined : true));

  const loadSet = async (id) => {
    try {
      const s = await api.get(`/common/sets/${id}`);
      const full = await Promise.all(s.codingIds.map((cid) => api.get(`/common/coding/${cid}`).catch(() => null)));
      setQuestions(s.questions);
      setCoding(full.filter(Boolean));
      setBand(s.band);
      setTimed(s.durationMinutes != null);
      if (s.durationMinutes) { setMinutes(s.durationMinutes); setMinutesTouched(true); }
      setSourceSetId(s.id);
      setModified(false);
      if (!title) setTitle(s.name);
    } catch (e) { toast(e.message, 'error'); }
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = { name, description, band, questionIds: questions.map((q) => q.id), codingIds: coding.map((p) => p.id), durationMinutes: timed ? minutes : null };
      const saved = initialSet?.id && mode === 'set' ? await api.put(`/common/sets/${initialSet.id}`, body) : await api.post('/common/sets', body);
      toast(initialSet?.id ? 'Set saved' : 'Set created');
      onSaved?.(saved);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const assign = async () => {
    setBusy(true);
    try {
      const body = enforce
        ? { candidateEpNo: candidate.epNo, setId: sourceSetId, title }
        : { candidateEpNo: candidate.epNo, setId: sourceSetId, title, band, questionIds: questions.map((q) => q.id), codingIds: coding.map((p) => p.id), durationMinutes: timed ? minutes : null };
      const exam = await api.post('/common/exams', body);
      toast(`Paper assigned to ${candidate.name || candidate.epNo}`);
      onAssigned?.(exam);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const saveAsTemplate = async () => {
    const n = window.prompt('Name for your template', title || `My ${bandLabel(band)} paper`);
    if (!n) return;
    try {
      await api.post('/common/sets', { name: n, band, questionIds: questions.map((q) => q.id), codingIds: coding.map((p) => p.id), durationMinutes: timed ? minutes : null });
      toast('Saved to your templates');
    } catch (e) { toast(e.message, 'error'); }
  };

  const move = (i, d) => change(() => setQuestions((qs) => { const n = [...qs]; const j = i + d; if (j < 0 || j >= n.length) return qs; [n[i], n[j]] = [n[j], n[i]]; return n; }));
  const locked = enforce || readOnlySet;

  if (!meta || !sets) return <Loading />;

  return (
    <div className="builder">
      <div className="stack" style={{ minWidth: 0 }}>
        {enforce && <div className="notice amber"><Lock size={18} /><span>Your admin requires papers to come from admin-defined sets. Pick one below; its questions can’t be changed.</span></div>}
        {readOnlySet && mode === 'set' && <div className="notice"><Lock size={18} /><span>This is an admin set. You can use it when assigning papers, or save a copy as your own template.</span></div>}

        {!readOnlySet && (
          <Panel title="Start the paper" subtitle={mode === 'assign' ? `For ${candidate.name || candidate.epNo}, ${candidate.totalExperience ?? '?'} years of experience` : undefined}>
            <div className="stack">
              {!enforce && (
                <Segmented value={source} onChange={setSource} options={[
                  { value: 'set', label: 'From a set' }, { value: 'generate', label: 'Auto-generate' }, { value: 'manual', label: 'Pick by hand' }]} />
              )}
              {source === 'set' && <SetChooser sets={visibleSets} selected={sourceSetId} onPick={loadSet} />}
              {source === 'generate' && <Generator band={band} setBand={setBand} topics={meta.topics} onGenerated={(qs, cs) => {
                setQuestions(qs); setCoding(cs.map((id) => (library || []).find((p) => p.id === id)).filter(Boolean)); setSourceSetId(null); setModified(true); setMinutesTouched(false);
              }} />}
              {source === 'manual' && (
                <div className="row">
                  <Button icon={BookOpen} onClick={() => setPicker(true)}>Add from question bank</Button>
                  {canWrite && <Button icon={PenLine} onClick={() => setWriter(true)}>Write a new question</Button>}
                  <Button icon={Code2} onClick={() => setCodingPicker(true)}>Choose hands-on problems</Button>
                </div>
              )}
            </div>
          </Panel>
        )}

        <Panel title={`Questions (${questions.length})`} pad={false} actions={!locked && questions.length > 0 && (
          <>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setPicker(true)}>Add</Button>
            {canWrite && <Button size="sm" variant="ghost" icon={PenLine} onClick={() => setWriter(true)}>Write new</Button>}
          </>
        )}>
          {questions.length === 0 ? (
            <Empty icon={Sparkles} title="No questions yet">Generate a balanced paper, start from a set, or add questions by hand.</Empty>
          ) : questions.map((q, i) => (
            <div key={q.id} className="q-item">
              <span className="idx">{i + 1}</span>
              <div>
                <div className="qt">{q.text}</div>
                <div className="q-meta"><Badge>{q.topic}</Badge><DiffBadge d={q.difficulty} />{q.band !== band && <Badge tone="amber">{bandLabel(q.band)}</Badge>}{!q.master && <Badge tone="info">Private</Badge>}</div>
              </div>
              {!locked && (
                <div className="row nowrap" style={{ gap: 0 }}>
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={15} /></button>
                  <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Move down"><ArrowDown size={15} /></button>
                  <button className="icon-btn" onClick={() => change(() => setQuestions((qs) => qs.filter((x) => x.id !== q.id)))} aria-label="Remove"><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </Panel>

        <Panel title={`Hands-on (${coding.length})`} pad={false} actions={!locked && <Button size="sm" variant="ghost" icon={Code2} onClick={() => setCodingPicker(true)}>Choose problems</Button>}>
          {coding.length === 0 ? <div className="panel-body small muted">No hands-on task. Add one to see how the candidate writes and tests code.</div> : coding.map((p) => (
            <div key={p.id} className="set-row">
              <div><div className="row"><b>{p.title}</b><DiffBadge d={p.difficulty} /><Badge>{bandLabel(p.band)}</Badge></div><div className="tiny muted mt8">{p.testCount ?? p.testCases?.length} tests, about {p.suggestedMinutes} min</div></div>
              {!locked && <button className="icon-btn" onClick={() => change(() => setCoding((cs) => cs.filter((x) => x.id !== p.id)))} aria-label="Remove"><Trash2 size={15} /></button>}
            </div>
          ))}
        </Panel>
      </div>

      <div className="stack builder-side">
        <Panel title={mode === 'assign' ? 'Paper settings' : 'Set details'}>
          <div className="stack">
            {mode === 'set' && (
              <>
                <Field label="Name"><input className="input" value={name} disabled={readOnlySet} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments senior developer" /></Field>
                <Field label="Description"><textarea className="textarea" rows={2} value={description || ''} disabled={readOnlySet} onChange={(e) => setDescription(e.target.value)} /></Field>
              </>
            )}
            {mode === 'assign' && <Field label="Paper title" hint="shown to the candidate"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Java assessment (${bandLabel(band)})`} /></Field>}
            <Field label="Experience band">
              <Segmented value={band} onChange={(b) => { setBand(b); setModified(true); }} disabled={locked} options={BANDS.map((b) => ({ value: b, label: b }))} />
            </Field>
            <div className="stack" style={{ gap: 8 }}>
              <Switch checked={timed} disabled={locked} onChange={(v) => { setTimed(v); setModified(true); }} label="Timed paper" />
              {timed && (
                <div className="row">
                  <input className="input" type="number" min="5" max="300" style={{ width: 90 }} value={minutes} disabled={locked}
                    onChange={(e) => { setMinutes(Number(e.target.value)); setMinutesTouched(true); setModified(true); }} />
                  <span className="small muted">minutes</span>
                  {minutesTouched && !locked && <button className="btn sm ghost" onClick={() => setMinutesTouched(false)}>Use suggested {suggest(questions, coding)}</button>}
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Composition">
          {questions.length === 0 ? <div className="small muted">Add questions to see the balance.</div> : (
            <div className="stack">
              <div>
                <div className="row between small"><span>Difficulty</span><span className="muted">{['EASY', 'MEDIUM', 'HARD'].map((d) => `${mix[d] || 0} ${diffLabel(d).toLowerCase()}`).join(', ')}</span></div>
                <div className="mt8"><MixBar mix={mix} /></div>
              </div>
              <div>
                <div className="small" style={{ marginBottom: 6 }}>Topics</div>
                <div className="stack" style={{ gap: 4 }}>
                  {topicMix.map(([t, n]) => (
                    <div key={t} className="row small" style={{ gap: 8 }}>
                      <span style={{ flex: 1 }}>{t}</span>
                      <div style={{ width: 90, height: 6, background: '#EEF1EF', borderRadius: 3 }}><div style={{ width: `${(100 * n) / topicMix[0][1]}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} /></div>
                      <span className="muted" style={{ width: 18, textAlign: 'right' }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="small muted">Suggested time: {suggest(questions, coding)} min (1.5 min per question plus each task’s estimate).</div>
            </div>
          )}
        </Panel>

        {mode === 'set' && !readOnlySet && (
          <Button variant="primary" size="lg" busy={busy} disabled={!name || (!questions.length && !coding.length)} onClick={save}>
            {initialSet?.id ? 'Save set' : admin ? 'Create admin set' : 'Save as my template'}
          </Button>
        )}
        {mode === 'set' && readOnlySet && <Button size="lg" onClick={saveAsTemplate}>Save a copy as my template</Button>}
        {mode === 'assign' && (
          <>
            <Button variant="primary" size="lg" busy={busy} disabled={enforce ? !sourceSetId : (!questions.length && !coding.length)} onClick={assign}>Assign to {candidate.name?.split(' ')[0] || candidate.epNo}</Button>
            {!enforce && (questions.length > 0 || coding.length > 0) && (!sourceSetId || modified) && <Button onClick={saveAsTemplate}>Also save as my template</Button>}
          </>
        )}
      </div>

      {picker && <QuestionPicker exclude={questions.map((q) => q.id)} defaultBand={band} onClose={() => setPicker(false)}
        onPick={(qs) => { change(() => setQuestions((cur) => [...cur, ...qs])); setPicker(false); }} />}
      {writer && <QuestionEditor topics={meta.topics} defaultBand={band} onClose={() => setWriter(false)}
        onSaved={(q) => { change(() => setQuestions((cur) => [...cur, q])); setWriter(false); }} />}
      {codingPicker && <CodingPicker library={library || []} selected={coding} onClose={() => setCodingPicker(false)}
        onPick={(cs) => { change(() => setCoding(cs)); setCodingPicker(false); }} />}
    </div>
  );
}

function SetChooser({ sets, selected, onPick }) {
  if (!sets.length) return <div className="small muted">No sets available yet.</div>;
  return (
    <div className="panel" style={{ maxHeight: 320, overflowY: 'auto' }}>
      {sets.map((s) => (
        <label key={s.id} className="set-row" style={{ cursor: 'pointer', background: selected === s.id ? 'var(--accent-soft)' : undefined }}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <input type="radio" name="set" checked={selected === s.id} onChange={() => onPick(s.id)} style={{ accentColor: 'var(--accent)', marginTop: 4 }} />
            <div>
              <div className="row"><b>{s.name}</b>{s.adminDefined ? <Badge tone="dark">Admin set</Badge> : <Badge tone="info">My template</Badge>}</div>
              <div className="tiny muted mt8">{bandLabel(s.band)}, {s.questionCount} questions, {s.codingCount} hands-on, {s.durationMinutes ? `${s.durationMinutes} min` : 'untimed'}</div>
            </div>
          </div>
          <MixBar mix={s.difficultyMix} />
        </label>
      ))}
    </div>
  );
}

function Generator({ band, setBand, topics, onGenerated }) {
  const { toast } = useUi();
  const [count, setCount] = useState(20);
  const [codingCount, setCodingCount] = useState(1);
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const toggle = (t) => setChosen((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));
  const run = async () => {
    setBusy(true); setNote(null);
    try {
      const g = await api.post('/common/sets/generate', { technology: 'JAVA', band, count, codingCount, topics: chosen });
      onGenerated(g.questions, g.codingIds);
      setNote(g.note);
      toast(`Generated ${g.questions.length} questions`);
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="stack">
      <div className="row" style={{ gap: 20, alignItems: 'flex-end' }}>
        <Field label="Experience band"><Segmented value={band} onChange={setBand} options={BANDS.map((b) => ({ value: b, label: b }))} /></Field>
        <Field label="Questions"><input className="input" type="number" min="1" max="100" style={{ width: 90 }} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
        <Field label="Hands-on"><input className="input" type="number" min="0" max="5" style={{ width: 80 }} value={codingCount} onChange={(e) => setCodingCount(Number(e.target.value))} /></Field>
      </div>
      <div>
        <div className="small" style={{ fontWeight: 500, marginBottom: 8 }}>Focus topics <span className="muted" style={{ fontWeight: 400 }}>– leave empty for a balanced spread</span></div>
        <div className="chips">{topics.map((t) => <button type="button" key={t} className={`chip ${chosen.includes(t) ? 'on' : ''}`} onClick={() => toggle(t)}>{t}</button>)}</div>
      </div>
      <div className="row"><Button variant="primary" icon={Wand2} busy={busy} onClick={run}>Generate paper</Button><span className="small muted">Difficulty mix follows the band; you can edit the result.</span></div>
      {note && <div className="notice amber small">{note}</div>}
    </div>
  );
}

function CodingPicker({ library, selected, onClose, onPick }) {
  const [ids, setIds] = useState(selected.map((p) => p.id));
  const toggle = (id) => setIds((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <Modal title="Choose hands-on problems" size="wide" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onPick(library.filter((p) => ids.includes(p.id)))}>Use {ids.length} problem{ids.length === 1 ? '' : 's'}</Button></>}>
      <div className="panel">
        {library.map((p) => (
          <label key={p.id} className="set-row" style={{ cursor: 'pointer', background: ids.includes(p.id) ? 'var(--accent-soft)' : undefined }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} style={{ accentColor: 'var(--accent)', marginTop: 4 }} />
              <div>
                <div className="row"><b>{p.title}</b><DiffBadge d={p.difficulty} /><Badge>{bandLabel(p.band)}</Badge>{!p.predefined && <Badge tone="info">Mine</Badge>}</div>
                <div className="small muted mt8">{p.excerpt}</div>
              </div>
            </div>
            <span className="tiny muted nowrap">{p.suggestedMinutes} min</span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
