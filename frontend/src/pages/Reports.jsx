import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { api } from '../api';
import { BANDS, bandLabel, fmtDate, STATUS } from '../format';
import { Button, DecisionBadge, Empty, ErrorNote, Loading, PageHead, Panel, RecBadge, ScoreBar, StatusBadge, useLoad } from '../ui';

const RECS = ['Strongly recommend', 'Recommend', 'Consider for next round', 'Not recommended'];

export default function Reports() {
  const nav = useNavigate();
  const [rows, loading, error] = useLoad(() => api.get('/admin/exams'));
  const [evals] = useLoad(() => api.get('/admin/evaluators'));
  const [f, setF] = useState({ q: '', status: '', evaluator: '', band: '', rec: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const list = useMemo(() => (rows || []).filter((e) =>
    (!f.status || e.status === f.status) && (!f.evaluator || e.evaluatorEmpNo === f.evaluator) && (!f.band || e.band === f.band) &&
    (!f.rec || e.recommendation === f.rec) && `${e.candidateName} ${e.candidateEpNo} ${e.title}`.toLowerCase().includes(f.q.toLowerCase())), [rows, f]);

  const exportCsv = () => {
    const head = ['Exam ID', 'EP number', 'Candidate', 'Evaluator', 'Paper', 'Band', 'Status', 'Assigned', 'Submitted', 'MCQ %', 'Hands-on %', 'Overall %', 'Recommendation score', 'Recommendation', 'Decision'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = list.map((e) => [e.id, e.candidateEpNo, e.candidateName, e.evaluatorName, e.title, e.band, STATUS[e.status]?.label, e.assignedAt?.slice(0, 10), e.submittedAt?.slice(0, 10), e.mcqScore, e.codingScore, e.totalScore, e.recommendationScore, e.recommendation, e.reviewDecision].map(esc).join(','));
    const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `examdesk-evaluations-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="stack">
      <PageHead title="Evaluation reports" subtitle="Every assessment across all evaluators, including history for repeat candidates. Open a row for the full report."
        actions={<Button icon={Download} disabled={!list.length} onClick={exportCsv}>Export {list.length} to CSV</Button>} />
      <ErrorNote error={error} />
      <Panel pad={false}>
        <div className="panel-head" style={{ flexWrap: 'wrap' }}>
          <div className="row" style={{ flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Candidate, EP number or paper" value={f.q} onChange={set('q')} />
            </div>
            <select className="select" style={{ width: 160 }} value={f.status} onChange={set('status')}><option value="">Any status</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <select className="select" style={{ width: 170 }} value={f.evaluator} onChange={set('evaluator')}><option value="">All evaluators</option>{(evals || []).map((e) => <option key={e.empNo} value={e.empNo}>{e.name}</option>)}</select>
            <select className="select" style={{ width: 120 }} value={f.band} onChange={set('band')}><option value="">All bands</option>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select>
            <select className="select" style={{ width: 200 }} value={f.rec} onChange={set('rec')}><option value="">Any recommendation</option>{RECS.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
        </div>
        {loading && !rows ? <Loading /> : list.length === 0 ? <Empty title="No assessments match" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Paper</th><th>Evaluator</th><th>Status</th><th>Submitted</th><th>Overall</th><th className="num">Rec. score</th><th>Recommendation</th><th>Decision</th></tr></thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="click" onClick={() => nav(`/report/${e.id}`)}>
                    <td><div className="cell-main">{e.candidateName}</div><div className="cell-sub">{e.candidateEpNo}</div></td>
                    <td><div>{e.title}</div><div className="cell-sub">{bandLabel(e.band)}, {e.questionCount} Q{e.codingCount ? ` + ${e.codingCount} hands-on` : ''}</div></td>
                    <td>{e.evaluatorName || <span className="muted">—</span>}</td>
                    <td><StatusBadge status={e.status} />{e.autoSubmitted && <div className="cell-sub">auto-submitted</div>}</td>
                    <td className="nowrap">{fmtDate(e.submittedAt)}</td>
                    <td style={{ minWidth: 130 }}>{e.totalScore != null ? <ScoreBar value={e.totalScore} /> : <span className="muted">—</span>}</td>
                    <td className="num"><b>{e.recommendationScore ?? '—'}</b></td>
                    <td><RecBadge label={e.recommendation} /></td>
                    <td><DecisionBadge decision={e.reviewDecision} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
