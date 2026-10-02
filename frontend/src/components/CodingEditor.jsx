import { lazy, Suspense, useState } from 'react';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { BANDS, bandLabel, DIFFS, diffLabel } from '../format';
import { Button, ErrorNote, Field, Loading, Modal, Segmented, Tabs, useUi } from '../ui';
import { RunResultView } from '../pages/ExamRunner';

const CodeEditor = lazy(() => import('./CodeEditor'));

const STARTER = `import java.util.*;

public class Solution {
    public int solve(int[] values) {
        // TODO: implement
        return 0;
    }
}
`;
const blank = () => ({
  title: '', band: '0-5', difficulty: 'MEDIUM', topic: 'Core Java', suggestedMinutes: 20, description: '',
  starterCode: STARTER, referenceSolution: '',
  testCases: [
    { name: 'Sample', call: 'new Solution().solve(new int[]{1, 2, 3})', expected: '6', hidden: false },
    { name: 'Empty input', call: 'new Solution().solve(new int[]{})', expected: '0', hidden: true },
  ],
});

/** Create or edit a hands-on problem: statement, starter template, reference solution and embedded tests. */
export default function CodingEditor({ problem, onClose, onSaved, readOnly = false }) {
  const { toast } = useUi();
  const [p, setP] = useState(() => (problem ? { ...problem, testCases: problem.testCases.map((t) => ({ ...t })) } : blank()));
  const [tab, setTab] = useState('statement');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setTest = (i, k, v) => setP((x) => ({ ...x, testCases: x.testCases.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));

  const validate = async (which) => {
    setChecking(true); setCheck(null);
    try { setCheck({ which, result: await api.post('/common/coding/validate', { code: which === 'reference' ? p.referenceSolution : p.starterCode, testCases: p.testCases }) }); }
    catch (e) { toast(e.message, 'error'); }
    finally { setChecking(false); }
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const saved = problem?.id ? await api.put(`/common/coding/${problem.id}`, p) : await api.post('/common/coding', p);
      toast(problem?.id ? 'Problem updated' : 'Problem created');
      onSaved(saved);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={readOnly ? problem.title : problem?.id ? `Edit: ${problem.title}` : 'New hands-on problem'} size="xwide" onClose={onClose}
      footer={readOnly ? <Button onClick={onClose}>Close</Button> : <><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={save}>{problem?.id ? 'Save changes' : 'Create problem'}</Button></>}>
      {readOnly && <div className="notice small" style={{ marginBottom: 14 }}>Library problem maintained by the admin. You can view it and run its tests, but not change it.</div>}
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'statement', label: 'Statement' }, { value: 'starter', label: 'Starter template' },
        { value: 'reference', label: 'Reference solution' }, { value: 'tests', label: 'Tests', count: p.testCases.length }]} />
      {tab === 'statement' && (
        <div className="stack">
          <div className="grid g2">
            <Field label="Title"><input className="input" value={p.title} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Topic"><input className="input" value={p.topic || ''} onChange={(e) => set('topic', e.target.value)} /></Field>
          </div>
          <div className="row" style={{ gap: 24, alignItems: 'flex-end' }}>
            <Field label="Band"><select className="select" value={p.band} onChange={(e) => set('band', e.target.value)}>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select></Field>
            <Field label="Difficulty"><Segmented value={p.difficulty} onChange={(v) => set('difficulty', v)} options={DIFFS.map((d) => ({ value: d, label: diffLabel(d) }))} /></Field>
            <Field label="Suggested minutes"><input className="input" type="number" min="5" style={{ width: 110 }} value={p.suggestedMinutes} onChange={(e) => set('suggestedMinutes', Number(e.target.value))} /></Field>
          </div>
          <Field label="Problem statement" hint="plain text; shown to the candidate next to the editor">
            <textarea className="textarea" rows={12} value={p.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      )}
      {(tab === 'starter' || tab === 'reference') && (
        <div className="stack">
          <p className="small muted">{tab === 'starter'
            ? 'What the candidate sees when they open the task. Keep a public class with the methods your tests call. No package line is needed.'
            : 'Optional and never shown to candidates. Use it to check that your tests are correct.'}</p>
          <div className="code-editor-box">
            <Suspense fallback={<Loading text="Loading editor…" />}>
              <CodeEditor value={tab === 'starter' ? p.starterCode : p.referenceSolution} onChange={(v) => set(tab === 'starter' ? 'starterCode' : 'referenceSolution', v)} height="380px" />
            </Suspense>
          </div>
          <div className="row">
            <Button icon={FlaskConical} busy={checking} disabled={tab === 'reference' && !p.referenceSolution} onClick={() => validate(tab)}>Run all tests against this code</Button>
            {check?.which === tab && <span className="small muted">{check.result.compiled ? `${check.result.passed}/${check.result.total} passed` : 'did not compile'}</span>}
          </div>
          {check?.which === tab && <div className="panel panel-pad"><RunResultView result={check.result} /></div>}
        </div>
      )}
      {tab === 'tests' && (
        <div className="stack">
          <div className="notice small">
            <span>Each test has a Java <b>call</b> (an expression such as <code>new Solution().twoSum(new int[]{'{'}2,7,11{'}'}, 9)</code>, or a block of statements ending in <code>return …;</code>) and an <b>expected</b> Java expression. Arrays, lists, maps and numbers are compared by value. Hidden tests only run when the candidate submits.</span>
          </div>
          {p.testCases.map((t, i) => (
            <div key={i} className="panel panel-pad" style={{ padding: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <input className="input" style={{ maxWidth: 260 }} value={t.name} onChange={(e) => setTest(i, 'name', e.target.value)} placeholder="Test name" />
                <label className="check"><input type="checkbox" checked={t.hidden} onChange={(e) => setTest(i, 'hidden', e.target.checked)} /> Hidden</label>
                <div className="spacer" />
                <button className="icon-btn" onClick={() => setP((x) => ({ ...x, testCases: x.testCases.filter((_, j) => j !== i) }))} aria-label="Remove test"><Trash2 size={16} /></button>
              </div>
              <div className="grid g2">
                <Field label="Call"><textarea className="textarea code" rows={3} value={t.call} onChange={(e) => setTest(i, 'call', e.target.value)} /></Field>
                <Field label="Expected"><textarea className="textarea code" rows={3} value={t.expected} onChange={(e) => setTest(i, 'expected', e.target.value)} /></Field>
              </div>
            </div>
          ))}
          <div className="row">
            <Button icon={Plus} onClick={() => setP((x) => ({ ...x, testCases: [...x.testCases, { name: `Test ${x.testCases.length + 1}`, call: '', expected: '', hidden: false }] }))}>Add test</Button>
            <Button icon={FlaskConical} busy={checking} disabled={!p.referenceSolution} onClick={() => validate('reference')}>Check tests with reference solution</Button>
          </div>
          {check?.which === 'reference' && <div className="panel panel-pad"><RunResultView result={check.result} /></div>}
        </div>
      )}
      <div className="mt16"><ErrorNote error={error} /></div>
    </Modal>
  );
}
