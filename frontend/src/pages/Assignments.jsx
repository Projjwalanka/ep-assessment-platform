import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { api } from '../api';
import { bandLabel } from '../format';
import { Badge, Button, ErrorNote, Loading, PageHead, Panel, Segmented, StatusBadge, useLoad, useUi } from '../ui';

export default function Assignments() {
  const { toast } = useUi();
  const [cands, cl, ce, reloadC] = useLoad(() => api.get('/admin/candidates'));
  const [evals, el, ee, reloadE] = useLoad(() => api.get('/admin/evaluators'));
  const [filter, setFilter] = useState('unmapped');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  const active = (evals || []).filter((e) => e.active);
  const list = useMemo(() => (cands || []).filter((c) => c.active)
    .filter((c) => filter === 'all' || (filter === 'unmapped' ? !c.evaluatorEmpNo : c.evaluatorEmpNo === filter))
    .filter((c) => `${c.epNo} ${c.name || ''}`.toLowerCase().includes(q.toLowerCase())), [cands, filter, q]);
  const allOn = list.length > 0 && list.every((c) => selected.includes(c.epNo));

  const apply = async () => {
    setBusy(true);
    try {
      const r = await api.post('/admin/mapping', { epNos: selected, empNo: target || null });
      toast(target ? `${r.updated} candidate(s) mapped to ${active.find((e) => e.empNo === target)?.name}` : `${r.updated} candidate(s) unmapped`);
      setSelected([]); reloadC(); reloadE();
    } catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  if ((cl && !cands) || (el && !evals)) return <Loading />;
  const unmapped = (cands || []).filter((c) => c.active && !c.evaluatorEmpNo).length;

  return (
    <div className="stack">
      <PageHead title="Candidate mapping" subtitle="Decide which evaluator owns each candidate. Evaluators only see and assess the candidates mapped to them." />
      <ErrorNote error={ce || ee} />
      <div className="stats">
        <div className={`stat ${unmapped ? 'warn' : ''}`}><div className="stat-value">{unmapped}</div><div className="stat-label">Not mapped</div></div>
        {active.map((e) => <div key={e.empNo} className="stat"><div className="stat-value">{e.candidateCount}</div><div className="stat-label">{e.name}</div></div>)}
      </div>
      <Panel pad={false} title="Candidates" actions={
        <div className="row">
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 32, width: 200 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: 210 }} value={filter} onChange={(e) => { setFilter(e.target.value); setSelected([]); }}>
            <option value="unmapped">Not mapped</option><option value="all">All candidates</option>
            {active.map((e) => <option key={e.empNo} value={e.empNo}>Mapped to {e.name}</option>)}
          </select>
        </div>}>
        <div className="table-wrap" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table className="table">
            <thead><tr>
              <th style={{ width: 36 }}><input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? [] : list.map((c) => c.epNo))} style={{ accentColor: 'var(--accent)' }} aria-label="Select all" /></th>
              <th>Candidate</th><th>Experience</th><th>Current evaluator</th><th>Latest paper</th>
            </tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.epNo} className="click" onClick={() => setSelected((s) => (s.includes(c.epNo) ? s.filter((x) => x !== c.epNo) : [...s, c.epNo]))}>
                  <td><input type="checkbox" readOnly checked={selected.includes(c.epNo)} style={{ accentColor: 'var(--accent)' }} /></td>
                  <td><div className="cell-main">{c.name || '—'}</div><div className="cell-sub">{c.epNo}</div></td>
                  <td>{c.totalExperience != null ? `${c.totalExperience} yrs` : '—'}<div className="cell-sub">{bandLabel(c.band)}</div></td>
                  <td>{c.evaluatorName ? c.evaluatorName : <Badge tone="amber">Not mapped</Badge>}</td>
                  <td>{c.latestStatus ? <StatusBadge status={c.latestStatus} /> : <span className="small muted">None</span>}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 30 }}>{filter === 'unmapped' ? 'Every active candidate is mapped.' : 'No candidates here.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel-body row" style={{ borderTop: '1px solid var(--line)' }}>
          <span className="small"><b>{selected.length}</b> selected</span>
          <ArrowRight size={16} color="var(--muted)" />
          <select className="select" style={{ width: 240 }} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Remove mapping</option>
            {active.map((e) => <option key={e.empNo} value={e.empNo}>{e.name} ({e.empNo})</option>)}
          </select>
          <Button variant="primary" busy={busy} disabled={!selected.length} onClick={apply}>{target ? 'Map selected' : 'Unmap selected'}</Button>
        </div>
      </Panel>
    </div>
  );
}
