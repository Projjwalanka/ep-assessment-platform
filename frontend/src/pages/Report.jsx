import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { api } from '../api';
import { fmtDateTime } from '../format';
import { Empty, ErrorNote, Loading, StatusBadge, useLoad } from '../ui';
import ReportView, { HistoryTable } from '../components/ReportView';
import { Panel } from '../ui';

export default function Report() {
  const { id } = useParams();
  const [data, loading, error, reload] = useLoad(() => api.get(`/common/exams/${id}/report`), [id]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const back = <Link to={-1} className="btn ghost sm no-print" style={{ alignSelf: 'flex-start' }} onClick={(e) => { e.preventDefault(); window.history.back(); }}><ArrowLeft size={16} /> Back</Link>;
  if (!data.report) {
    const s = data.summary;
    return (
      <div className="stack">
        {back}
        <div className="page-head"><div><div className="row"><h1>{s.candidateName}</h1><StatusBadge status={s.status} /></div><p>{s.candidateEpNo}, {s.title}</p></div></div>
        <Panel>
          <Empty icon={Clock} title={s.status === 'IN_PROGRESS' ? 'The candidate is taking this assessment now' : 'The candidate hasn’t started yet'}>
            {s.status === 'IN_PROGRESS' ? `Started ${fmtDateTime(s.startedAt)}. The report appears here as soon as it’s submitted.` : `Assigned ${fmtDateTime(s.assignedAt)}. Share the EP number and access code with the candidate if you haven’t already.`}
          </Empty>
        </Panel>
        {data.history?.length > 1 && <Panel title="Assessment history" pad={false}><HistoryTable rows={data.history} currentId={s.id} /></Panel>}
      </div>
    );
  }
  return <div className="stack">{back}<ReportView data={data} onReviewed={reload} /></div>;
}
