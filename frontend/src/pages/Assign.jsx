import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '../api';
import { bandLabel, fmtDate } from '../format';
import { Button, ErrorNote, Loading, PageHead, Panel, StatusBadge, useLoad, useUi } from '../ui';
import SetBuilder from '../components/SetBuilder';

export default function Assign() {
  const { ep } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const [data, loading, error, reload] = useLoad(() => api.get(`/common/candidates/${ep}`), [ep]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const c = data.candidate;
  const open = data.exams.filter((e) => e.status === 'ASSIGNED' || e.status === 'IN_PROGRESS');

  const withdraw = async (e) => {
    if (!(await confirm({ title: 'Withdraw this paper?', message: `${e.title} will be removed from ${c.name || c.epNo}’s list.`, confirmText: 'Withdraw', danger: true }))) return;
    try { await api.del(`/common/exams/${e.id}`); toast('Paper withdrawn'); reload(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="stack">
      <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => nav(-1)}><ArrowLeft size={16} /> Back</button>
      <PageHead title={`Assign a paper to ${c.name || c.epNo}`}
        subtitle={`${c.epNo}, ${c.totalExperience != null ? `${c.totalExperience} years` : 'experience not given'}, ${bandLabel(c.band)} band${c.primarySkills ? `. Skills: ${c.primarySkills}` : ''}`} />
      {open.length > 0 && (
        <Panel title="Already assigned" pad={false}>
          {open.map((e) => (
            <div key={e.id} className="set-row">
              <div><div className="row"><b>{e.title}</b><StatusBadge status={e.status} /></div><div className="tiny muted mt8">Assigned {fmtDate(e.assignedAt)}, {e.questionCount} questions, {e.codingCount} hands-on</div></div>
              {e.status === 'ASSIGNED' ? <Button size="sm" className="danger" icon={Trash2} onClick={() => withdraw(e)}>Withdraw</Button> : <Link to={`/report/${e.id}`} className="small">View</Link>}
            </div>
          ))}
        </Panel>
      )}
      <SetBuilder mode="assign" candidate={c} onAssigned={() => nav(-1)} />
    </div>
  );
}
