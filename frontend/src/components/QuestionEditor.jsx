import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { BANDS, bandLabel, DIFFS, diffLabel, letter } from '../format';
import { Button, ErrorNote, Field, Modal, Segmented, useUi } from '../ui';

const blank = (band) => ({ text: '', options: ['', '', '', ''], correctIndex: 0, band: band || '0-5', topic: '', difficulty: 'MEDIUM', explanation: '', addToMaster: false });

/** Create or edit a single MCQ. Evaluators can optionally contribute it to the master bank. */
export default function QuestionEditor({ question, topics = [], defaultBand, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useUi();
  const [q, setQ] = useState(() => (question ? { ...question, options: [...question.options], addToMaster: false } : blank(defaultBand)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setQ((x) => ({ ...x, [k]: v }));
  const setOpt = (i, v) => setQ((x) => { const o = [...x.options]; o[i] = v; return { ...x, options: o }; });
  const addOpt = () => setQ((x) => ({ ...x, options: [...x.options, ''] }));
  const delOpt = (i) => setQ((x) => {
    const o = x.options.filter((_, j) => j !== i);
    const c = x.correctIndex === i ? 0 : x.correctIndex > i ? x.correctIndex - 1 : x.correctIndex;
    return { ...x, options: o, correctIndex: c };
  });

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const filled = q.options.map((o) => o.trim());
      if (!filled[q.correctIndex]) throw new Error('The option marked correct is empty.');
      const kept = filled.filter(Boolean);
      const correctIndex = kept.indexOf(filled[q.correctIndex]);
      const body = { ...q, options: kept, correctIndex };
      const saved = question?.id ? await api.put(`/common/questions/${question.id}`, body) : await api.post('/common/questions', body);
      toast(question?.id ? 'Question updated' : 'Question added');
      onSaved(saved);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={question?.id ? 'Edit question' : 'New question'} size="wide" onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={save}>{question?.id ? 'Save changes' : 'Add question'}</Button></>}>
      <div className="stack">
        <Field label="Question">
          <textarea className="textarea" rows={4} value={q.text} onChange={(e) => set('text', e.target.value)} placeholder="Write the question. Code snippets keep their line breaks." />
        </Field>
        <div>
          <div className="small" style={{ fontWeight: 500, marginBottom: 8 }}>Options <span className="muted" style={{ fontWeight: 400 }}>– click a letter to mark the correct answer</span></div>
          {q.options.map((o, i) => (
            <div className="opt-edit" key={i}>
              <button type="button" className={`radio-key ${q.correctIndex === i ? 'on' : ''}`} onClick={() => set('correctIndex', i)} aria-label={`Mark option ${letter(i)} correct`}>{letter(i)}</button>
              <input className="input" value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Option ${letter(i)}`} />
              <button type="button" className="icon-btn" onClick={() => delOpt(i)} disabled={q.options.length <= 2} aria-label="Remove option"><Trash2 size={16} /></button>
            </div>
          ))}
          {q.options.length < 6 && <Button size="sm" variant="ghost" icon={Plus} onClick={addOpt}>Add option</Button>}
        </div>
        <div className="grid g3">
          <Field label="Experience band">
            <select className="select" value={q.band} onChange={(e) => set('band', e.target.value)}>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select>
          </Field>
          <Field label="Topic">
            <input className="input" list="topic-list" value={q.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Spring Boot" />
            <datalist id="topic-list">{topics.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <Field label="Difficulty">
            <Segmented value={q.difficulty} onChange={(v) => set('difficulty', v)} options={DIFFS.map((d) => ({ value: d, label: diffLabel(d) }))} />
          </Field>
        </div>
        <Field label="Explanation" hint="optional, shown to evaluators in the report">
          <textarea className="textarea" rows={2} value={q.explanation || ''} onChange={(e) => set('explanation', e.target.value)} />
        </Field>
        {user.role === 'EVALUATOR' && !question?.master && (
          <label className="check"><input type="checkbox" checked={q.addToMaster} onChange={(e) => set('addToMaster', e.target.checked)} /> Also add to the master question bank so other evaluators can use it</label>
        )}
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}
