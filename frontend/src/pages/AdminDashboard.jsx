import { Link, useNavigate } from 'react-router-dom';
import { FileUp, UserPlus } from 'lucide-react';
import { api } from '../api';
import { BANDS, bandLabel, fmtDate } from '../format';
import { DecisionBadge, ErrorNote, Loading, PageHead, Panel, RecBadge, ScoreBar, useLoad } from '../ui';
import { BandPerformance, Donut, REC_COLORS, TrendChart } from '../components/Charts';

export default function AdminDashboard() {
  const [d, loading, error] = useLoad(() => api.get('/admin/dashboard'));
  const nav = useNavigate();
  if (loading && !d) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const c = d.counts;
  const maxCell = Math.max(1, ...d.questionMatrix.flatMap((r) => BANDS.map((b) => r[b])));
  return (
    <div className="stack">
      <PageHead title="Hiring assessments overview" subtitle="Activity across all evaluators, candidates and the question bank."
        actions={<>
          <Link className="btn" to="/import"><FileUp size={16} /> Import questions</Link>
          <Link className="btn primary" to="/people"><UserPlus size={16} /> Add candidate</Link>
        </>} />

      <div className="stats">
        <div className="stat"><div className="stat-value">{c.candidates}</div><div className="stat-label">Candidates</div>{c.unmapped > 0 && <div className="stat-hint">{c.unmapped} not mapped to an evaluator</div>}</div>
        <div className="stat"><div className="stat-value">{c.evaluators}</div><div className="stat-label">Evaluators</div></div>
        <div className="stat"><div className="stat-value">{c.pending}</div><div className="stat-label">Assessments open</div></div>
        <div className={`stat ${c.awaitingReview ? 'warn' : ''}`}><div className="stat-value">{c.awaitingReview}</div><div className="stat-label">Awaiting review</div></div>
        <div className="stat"><div className="stat-value">{c.avgScore ?? '—'}{c.avgScore != null && <span style={{ fontSize: '1rem' }}>%</span>}</div><div className="stat-label">Average score</div></div>
        <div className="stat"><div className="stat-value">{c.questions}</div><div className="stat-label">Master questions</div><div className="stat-hint">{c.sets} admin sets, {c.codingProblems} hands-on</div></div>
      </div>

      <div className="grid g3">
        <Panel title="Submissions and average score" subtitle="Last 12 weeks" className="span2"><TrendChart data={d.trend} /></Panel>
        <Panel title="Recommendations" subtitle="All submitted assessments"><Donut data={d.recommendationDist} colors={REC_COLORS} /></Panel>
      </div>

      <div className="grid g2">
        <Panel title="Scores by experience band" subtitle="Average overall score against the expected bar"><BandPerformance data={d.bandPerformance} /></Panel>
        <Panel title="Evaluator workload" pad={false}>
          <table className="table">
            <thead><tr><th>Evaluator</th><th className="num">Candidates</th><th className="num">Open</th><th className="num">To review</th><th className="num">Reviewed</th></tr></thead>
            <tbody>
              {d.evaluatorLoad.map((e) => (
                <tr key={e.empNo}>
                  <td><div className="cell-main">{e.name}</div><div className="cell-sub">{e.empNo}</div></td>
                  <td className="num">{e.candidates}</td><td className="num">{e.pending}</td>
                  <td className="num">{e.toReview ? <b style={{ color: 'var(--amber)' }}>{e.toReview}</b> : 0}</td><td className="num">{e.reviewed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="grid g2">
        <Panel title="Question bank coverage" subtitle="Active master questions by topic and band" pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Topic</th>{BANDS.map((b) => <th key={b} className="num">{bandLabel(b)}</th>)}<th className="num">Total</th></tr></thead>
              <tbody>
                {d.questionMatrix.map((r) => (
                  <tr key={r.topic}>
                    <td>{r.topic}</td>
                    {BANDS.map((b) => (
                      <td key={b} className="num" style={{ background: r[b] ? `rgba(31,111,107,${0.08 + 0.5 * (r[b] / maxCell)})` : undefined, color: r[b] / maxCell > 0.6 ? '#fff' : undefined }}>{r[b] || ''}</td>
                    ))}
                    <td className="num"><b>{r.total}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Latest submissions" pad={false} actions={<Link to="/reports" className="small">All reports</Link>}>
          <table className="table">
            <thead><tr><th>Candidate</th><th>Score</th><th>Recommendation</th></tr></thead>
            <tbody>
              {d.recent.map((e) => (
                <tr key={e.id} className="click" onClick={() => nav(`/report/${e.id}`)}>
                  <td><div className="cell-main">{e.candidateName}</div><div className="cell-sub">{e.candidateEpNo}, {fmtDate(e.submittedAt)}</div></td>
                  <td style={{ minWidth: 130 }}><ScoreBar value={e.totalScore} /></td>
                  <td><div className="stack" style={{ gap: 4 }}><RecBadge label={e.recommendation} /><DecisionBadge decision={e.reviewDecision} /></div></td>
                </tr>
              ))}
              {d.recent.length === 0 && <tr><td colSpan={3} className="muted">No submissions yet.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
