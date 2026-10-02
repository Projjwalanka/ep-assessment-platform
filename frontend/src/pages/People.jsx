import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Eye, EyeOff, FilePlus2, History, KeyRound, Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import { api } from '../api';
import { BANDS, bandLabel } from '../format';
import {
  Badge, Button, copyText, DecisionBadge, Empty, ErrorNote, Field, Loading, Modal, PageHead, Panel, RecBadge,
  ScoreBar, StatusBadge, Tabs, useLoad, useUi,
} from '../ui';
import { HistoryTable } from '../components/ReportView';

export default function People() {
  const [tab, setTab] = useState('candidates');
  const [cands, cl, ce, reloadC] = useLoad(() => api.get('/admin/candidates'));
  const [evals, el, ee, reloadE] = useLoad(() => api.get('/admin/evaluators'));
  const reload = () => { reloadC(); reloadE(); };
  return (
    <div className="stack">
      <PageHead title="Candidates and evaluators" subtitle="Candidates sign in with their EP number and an access code. Evaluators sign in with their employee number and a password." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'candidates', label: 'Candidates', count: cands?.length },
        { value: 'evaluators', label: 'Evaluators', count: evals?.length }]} />
      <ErrorNote error={ce || ee} />
      {tab === 'candidates'
        ? (cl && !cands ? <Loading /> : <Candidates rows={cands || []} evaluators={evals || []} reload={reload} />)
        : (el && !evals ? <Loading /> : <Evaluators rows={evals || []} reload={reload} />)}
    </div>
  );
}

function Candidates({ rows, evaluators, reload }) {
  const { toast, confirm } = useUi();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [credential, setCredential] = useState(null);
  const [history, setHistory] = useState(null);
  const [shown, setShown] = useState({});
  const active = evaluators.filter((e) => e.active);
  const list = useMemo(() => rows.filter((c) => `${c.epNo} ${c.name || ''} ${c.email || ''} ${c.evaluatorName || ''}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);

  const map = async (ep, empNo) => {
    try { await api.post('/admin/mapping', { epNos: [ep], empNo: empNo || null }); toast(empNo ? `Mapped to ${empNo}` : 'Unmapped'); reload(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const resetCode = async (c) => {
    if (!(await confirm({ title: 'Issue a new access code?', message: `${c.name || c.epNo}’s current code stops working immediately.`, confirmText: 'Issue new code' }))) return;
    try { const r = await api.post(`/admin/candidates/${c.epNo}/reset-code`); setCredential({ ...c, accessCode: r.accessCode }); reload(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const remove = async (c) => {
    if (!(await confirm({ title: `Remove ${c.name || c.epNo}?`, message: c.examCount ? 'This candidate has assessment history, so they will be deactivated rather than deleted. Their reports stay available.' : 'The candidate will be deleted.', confirmText: 'Remove', danger: true }))) return;
    try { await api.del(`/admin/candidates/${c.epNo}`); toast('Candidate removed'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Panel pad={false} title={`${rows.length} candidates`} actions={<>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32, width: 230 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="primary" icon={UserPlus} onClick={() => setEditing({})}>Add candidate</Button>
      </>}>
        {list.length === 0 ? <Empty title="No candidates">Add a candidate to get started.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Experience</th><th>Evaluator</th><th>Access code</th><th>Latest</th><th>Score</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.epNo} style={{ opacity: c.active ? 1 : 0.55 }}>
                    <td><div className="cell-main">{c.name || '—'} {!c.active && <Badge>Inactive</Badge>}</div><div className="cell-sub">{c.epNo}{c.email ? `, ${c.email}` : ''}</div></td>
                    <td className="nowrap">{c.totalExperience != null ? `${c.totalExperience} yrs` : '—'}<div className="cell-sub">{bandLabel(c.band)}</div></td>
                    <td>
                      <select className="select" style={{ minWidth: 170, padding: '5px 8px' }} value={c.evaluatorEmpNo || ''} onChange={(e) => map(c.epNo, e.target.value)}>
                        <option value="">Not mapped</option>
                        {active.map((e) => <option key={e.empNo} value={e.empNo}>{e.name}</option>)}
                      </select>
                    </td>
                    <td className="nowrap">
                      <span className="mono">{shown[c.epNo] ? c.accessCode : '••••••••'}</span>
                      <button className="icon-btn" onClick={() => setShown((s) => ({ ...s, [c.epNo]: !s[c.epNo] }))} aria-label="Show code">{shown[c.epNo] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button className="icon-btn" onClick={() => copyText(c.accessCode, toast)} aria-label="Copy code"><Copy size={15} /></button>
                    </td>
                    <td>{c.latestStatus ? <StatusBadge status={c.latestStatus} /> : <span className="small muted">No paper</span>}<div className="mt8"><DecisionBadge decision={c.latestDecision} /></div></td>
                    <td style={{ minWidth: 150 }}>{c.latestScore != null ? <><ScoreBar value={c.latestScore} /><div className="mt8"><RecBadge label={c.latestRecommendation} /></div></> : <span className="muted">—</span>}</td>
                    <td className="right nowrap">
                      <button className="icon-btn" title="Assign a paper" onClick={() => nav(`/assign/${c.epNo}`)}><FilePlus2 size={16} /></button>
                      <button className="icon-btn" title="Assessment history" onClick={() => setHistory(c)}><History size={16} /></button>
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(c)}><Pencil size={16} /></button>
                      <button className="icon-btn" title="New access code" onClick={() => resetCode(c)}><KeyRound size={16} /></button>
                      <button className="icon-btn" title="Remove" onClick={() => remove(c)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {editing && <CandidateForm candidate={editing.epNo ? editing : null} evaluators={active} onClose={() => setEditing(null)}
        onSaved={(c, created) => { setEditing(null); reload(); if (created) setCredential(c); }} />}
      {credential && <CredentialModal title="Share these sign-in details" lines={[['EP number', credential.epNo], ['Access code', credential.accessCode]]}
        message={`Hi ${credential.name || ''},\n\nYou've been invited to a Java technical assessment on ExamDesk.\n\nSign-in page: ${window.location.origin}\nChoose "Candidate", then enter:\nEP number: ${credential.epNo}\nAccess code: ${credential.accessCode}\n\nFill in your profile first, then start the assessment when you're ready.`}
        onClose={() => setCredential(null)} />}
      {history && <HistoryModal candidate={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function CandidateForm({ candidate, evaluators, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ epNo: '', name: '', email: '', phone: '', totalExperience: '', band: '', evaluatorEmpNo: '', accessCode: '', ...Object.fromEntries(Object.entries(candidate || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const body = { ...f, totalExperience: f.totalExperience === '' ? null : f.totalExperience };
      if (candidate) onSaved(await api.put(`/admin/candidates/${candidate.epNo}`, body), false);
      else onSaved(await api.post('/admin/candidates', body), true);
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={candidate ? `Edit ${candidate.epNo}` : 'Add candidate'} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={save}>{candidate ? 'Save changes' : 'Add candidate'}</Button></>}>
      <div className="grid g2">
        <Field label="EP number"><input className="input" value={f.epNo} disabled={!!candidate} onChange={set('epNo')} placeholder="EP10021" /></Field>
        <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Experience (years)"><input className="input" type="number" min="0" step="0.5" value={f.totalExperience} onChange={set('totalExperience')} /></Field>
        <Field label="Assessment band" hint="blank = from experience">
          <select className="select" value={f.band} onChange={set('band')}><option value="">Automatic</option>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select>
        </Field>
        <Field label="Evaluator" className="span2">
          <select className="select" value={f.evaluatorEmpNo} onChange={set('evaluatorEmpNo')}><option value="">Map later</option>{evaluators.map((e) => <option key={e.empNo} value={e.empNo}>{e.name} ({e.empNo})</option>)}</select>
        </Field>
        {!candidate && <Field label="Access code" hint="blank = generate one" className="span2"><input className="input" value={f.accessCode} onChange={set('accessCode')} /></Field>}
        {error && <div className="span2"><ErrorNote error={error} /></div>}
      </div>
    </Modal>
  );
}

function Evaluators({ rows, reload }) {
  const { toast, confirm } = useUi();
  const [editing, setEditing] = useState(null);
  const [credential, setCredential] = useState(null);

  const reset = async (e) => {
    if (!(await confirm({ title: `Reset ${e.name}’s password?`, message: 'A new password is generated and their current sessions end.', confirmText: 'Reset password' }))) return;
    try { const r = await api.post(`/admin/evaluators/${e.empNo}/reset-password`); setCredential({ ...e, password: r.password }); } catch (err) { toast(err.message, 'error'); }
  };
  const toggle = async (e) => {
    try { await api.put(`/admin/evaluators/${e.empNo}`, { active: !e.active }); toast(e.active ? 'Evaluator deactivated' : 'Evaluator reactivated'); reload(); } catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (e) => {
    if (!(await confirm({ title: `Remove ${e.name}?`, message: `Their ${e.candidateCount} mapped candidate(s) will become unmapped. If they have assessment history they are deactivated instead of deleted.`, confirmText: 'Remove', danger: true }))) return;
    try { await api.del(`/admin/evaluators/${e.empNo}`); toast('Evaluator removed'); reload(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <Panel pad={false} title={`${rows.length} evaluators`} actions={<Button variant="primary" icon={UserPlus} onClick={() => setEditing({})}>Add evaluator</Button>}>
        {rows.length === 0 ? <Empty title="No evaluators yet" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Evaluator</th><th>Department</th><th className="num">Candidates</th><th className="num">Open</th><th className="num">To review</th><th className="num">Reviewed</th><th>Status</th><th /></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.empNo}>
                    <td><div className="cell-main">{e.name}</div><div className="cell-sub">{e.empNo}{e.email ? `, ${e.email}` : ''}</div></td>
                    <td>{e.department || '—'}</td>
                    <td className="num">{e.candidateCount}</td><td className="num">{e.pending}</td><td className="num">{e.toReview}</td><td className="num">{e.reviewed}</td>
                    <td>{e.active ? <Badge tone="pass">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className="right nowrap">
                      <button className="icon-btn" title="Edit" onClick={() => setEditing(e)}><Pencil size={16} /></button>
                      <button className="icon-btn" title="Reset password" onClick={() => reset(e)}><KeyRound size={16} /></button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(e)}>{e.active ? 'Deactivate' : 'Reactivate'}</Button>
                      <button className="icon-btn" title="Remove" onClick={() => remove(e)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {editing && <EvaluatorForm evaluator={editing.empNo ? editing : null} onClose={() => setEditing(null)}
        onSaved={(r) => { setEditing(null); reload(); if (r?.password) setCredential(r); }} />}
      {credential && <CredentialModal title="Share these sign-in details" lines={[['Employee number', credential.empNo], ['Password', credential.password]]}
        message={`Hi ${credential.name || ''},\n\nYou've been set up as an evaluator on ExamDesk.\n\nSign-in page: ${window.location.origin}\nChoose "Evaluator", then enter:\nEmployee number: ${credential.empNo}\nPassword: ${credential.password}`}
        note="This password is shown only once. If it’s lost, reset it to issue a new one." onClose={() => setCredential(null)} />}
    </>
  );
}

function EvaluatorForm({ evaluator, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ empNo: '', name: '', email: '', department: '', password: '', ...Object.fromEntries(Object.entries(evaluator || {}).map(([k, v]) => [k, v ?? ''])) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      if (evaluator) { await api.put(`/admin/evaluators/${evaluator.empNo}`, { name: f.name, email: f.email, department: f.department }); onSaved(null); }
      else onSaved(await api.post('/admin/evaluators', f));
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={evaluator ? `Edit ${evaluator.empNo}` : 'Add evaluator'} onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={busy} onClick={save}>{evaluator ? 'Save changes' : 'Add evaluator'}</Button></>}>
      <div className="grid g2">
        <Field label="Employee number"><input className="input" value={f.empNo} disabled={!!evaluator} onChange={set('empNo')} placeholder="E1004" /></Field>
        <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Department"><input className="input" value={f.department} onChange={set('department')} /></Field>
        {!evaluator && <Field label="Password" hint="blank = generate one, min 8 characters" className="span2"><input className="input" type="text" value={f.password} onChange={set('password')} /></Field>}
        {error && <div className="span2"><ErrorNote error={error} /></div>}
      </div>
    </Modal>
  );
}

function CredentialModal({ title, lines, message, note, onClose }) {
  const { toast } = useUi();
  return (
    <Modal title={title} onClose={onClose} footer={<><Button icon={Copy} onClick={() => copyText(message, toast)}>Copy invitation message</Button><Button variant="primary" onClick={onClose}>Done</Button></>}>
      <div className="stack">
        <dl className="kv">{lines.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd className="mono" style={{ fontSize: '1rem' }}>{v}</dd></Fragment>)}</dl>
        {note && <div className="notice amber small">{note}</div>}
        <pre className="code-view" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--sans)', fontSize: '0.85rem' }}>{message}</pre>
      </div>
    </Modal>
  );
}

function HistoryModal({ candidate, onClose }) {
  const [rows, loading] = useLoad(() => api.get(`/admin/candidates/${candidate.epNo}/exams`), [candidate.epNo]);
  return (
    <Modal title={`${candidate.name || candidate.epNo}: assessment history`} size="xwide" onClose={onClose}>
      {loading ? <Loading /> : rows.length ? <div className="panel"><HistoryTable rows={rows} /></div> : <Empty title="No assessments yet" />}
    </Modal>
  );
}
