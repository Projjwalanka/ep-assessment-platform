import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePlus2, Search, Users } from 'lucide-react';
import { api } from '../api';
import { bandLabel } from '../format';
import { DecisionBadge, Empty, ErrorNote, Loading, PageHead, Panel, RecBadge, ScoreBar, StatusBadge, useLoad } from '../ui';

export default function MyCandidates() {
  const [rows, loading, error] = useLoad(() => api.get('/evaluator/candidates'));
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const list = useMemo(() => (rows || []).filter((c) => `${c.name} ${c.epNo} ${c.primarySkills || ''}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  if (loading && !rows) return <Loading />;
  return (
    <div className="stack">
      <PageHead title="My candidates" subtitle="Candidates your admin has mapped to you. Assign a paper, then open the report once they submit." />
      <ErrorNote error={error} />
      <Panel pad={false} title={`${rows?.length || 0} candidates`} actions={
        <div className="row" style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32, width: 240 }} placeholder="Search name, EP or skill" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>}>
        {list.length === 0 ? <Empty icon={Users} title={rows?.length ? 'No matches' : 'No candidates mapped to you yet'}>{rows?.length ? 'Try a different search.' : 'Your admin maps candidates to evaluators. Ask them to assign candidates to you.'}</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Experience</th><th>Profile</th><th>Latest paper</th><th>Score</th><th>Recommendation</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.epNo}>
                    <td><div className="cell-main">{c.name || '—'}</div><div className="cell-sub">{c.epNo}{c.currentCompany ? `, ${c.currentCompany}` : ''}</div></td>
                    <td className="nowrap">{c.totalExperience != null ? `${c.totalExperience} yrs` : '—'}<div className="cell-sub">{bandLabel(c.band)} band</div></td>
                    <td>{c.profileCompleted ? <span className="badge pass">Complete</span> : <span className="badge">Not filled in</span>}</td>
                    <td>{c.latestStatus ? <StatusBadge status={c.latestStatus} /> : <span className="muted small">No paper yet</span>}</td>
                    <td style={{ minWidth: 130 }}>{c.latestScore != null ? <ScoreBar value={c.latestScore} /> : <span className="muted">—</span>}</td>
                    <td><div className="stack" style={{ gap: 4 }}><RecBadge label={c.latestRecommendation} /><DecisionBadge decision={c.latestDecision} /></div></td>
                    <td className="right nowrap">
                      {c.latestReportId && <Link className="btn sm ghost" to={`/report/${c.latestReportId}`}>Report</Link>}
                      <button className="btn sm" onClick={() => nav(`/assign/${c.epNo}`)}><FilePlus2 size={15} /> Assign paper</button>
                    </td>
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
