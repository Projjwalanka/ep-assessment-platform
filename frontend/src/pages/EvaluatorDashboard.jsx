import { Link, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '../api';
import { fmtDate } from '../format';
import { Empty, ErrorNote, Loading, PageHead, Panel, RecBadge, ScoreBar, StatusBadge, useLoad } from '../ui';
import { CandidateScores, Donut, REC_COLORS, TopicBars } from '../components/Charts';
import { useAuth } from '../auth';

export default function EvaluatorDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [d, loading, error] = useLoad(() => api.get('/evaluator/dashboard'));
  if (loading && !d) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const c = d.counts;
  return (
    <div className="stack">
      <PageHead title={`Good to see you, ${user.name.split(' ')[0]}`} subtitle="Your candidates, their progress and how they’re scoring."
        actions={<Link to="/my-candidates" className="btn primary"><Users size={16} /> My candidates</Link>} />
      <div className="stats">
        <div className="stat"><div className="stat-value">{c.candidates}</div><div className="stat-label">Candidates assigned to you</div>{c.notAssigned > 0 && <div className="stat-hint">{c.notAssigned} still need a paper</div>}</div>
        <div className="stat"><div className="stat-value">{c.pending}</div><div className="stat-label">Assessments open</div></div>
        <div className={`stat ${c.toReview ? 'warn' : ''}`}><div className="stat-value">{c.toReview}</div><div className="stat-label">Waiting for your review</div></div>
        <div className="stat"><div className="stat-value">{c.reviewed}</div><div className="stat-label">Reviewed</div></div>
        <div className="stat"><div className="stat-value">{c.avgScore ?? '—'}{c.avgScore != null && <span style={{ fontSize: '1rem' }}>%</span>}</div><div className="stat-label">Average score</div></div>
      </div>

      {d.candidateScores.length === 0 ? (
        <Panel><Empty icon={Users} title="No results yet" action={<Link className="btn primary" to="/my-candidates">Assign a paper</Link>}>Once your candidates submit, their scores and topic profiles appear here.</Empty></Panel>
      ) : (
        <>
          <div className="grid g3">
            <Panel title="Latest score per candidate" subtitle="Dashed line marks 65, the recommend threshold" className="span2"><CandidateScores data={d.candidateScores} /></Panel>
            <Panel title="Recommendations"><Donut data={d.recommendationDist} colors={REC_COLORS} /></Panel>
          </div>
          <Panel title="Where your candidates are strong and weak" subtitle="Correct answers by topic, across all their submissions"><TopicBars data={d.topicAverages} /></Panel>
        </>
      )}

      <Panel title="Recent activity" pad={false}>
        <table className="table">
          <thead><tr><th>Candidate</th><th>Paper</th><th>Status</th><th>Score</th><th>Recommendation</th></tr></thead>
          <tbody>
            {d.recent.map((e) => (
              <tr key={e.id} className="click" onClick={() => nav(`/report/${e.id}`)}>
                <td><div className="cell-main">{e.candidateName}</div><div className="cell-sub">{e.candidateEpNo}</div></td>
                <td><div>{e.title}</div><div className="cell-sub">Assigned {fmtDate(e.assignedAt)}</div></td>
                <td><StatusBadge status={e.status} /></td>
                <td style={{ minWidth: 130 }}>{e.totalScore != null ? <ScoreBar value={e.totalScore} /> : <span className="muted">—</span>}</td>
                <td><RecBadge label={e.recommendation} /></td>
              </tr>
            ))}
            {d.recent.length === 0 && <tr><td colSpan={5} className="muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
