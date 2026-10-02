import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorNote, Loading, PageHead, useLoad } from '../ui';
import SetBuilder from '../components/SetBuilder';

export default function SetEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [set, loading, error] = useLoad(() => (id ? api.get(`/common/sets/${id}`) : Promise.resolve(null)), [id]);
  if (loading) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  const admin = user.role === 'ADMIN';
  return (
    <div className="stack">
      <Link to="/sets" className="btn ghost sm" style={{ alignSelf: 'flex-start' }}><ArrowLeft size={16} /> All sets</Link>
      <PageHead title={set ? set.name : admin ? 'New admin set' : 'New template'}
        subtitle={set ? `${set.questionCount} questions and ${set.codingCount} hands-on` : 'Generate a balanced paper from a band and count, then adjust it by hand.'} />
      <SetBuilder key={id || 'new'} mode="set" initialSet={set} onSaved={(s) => nav(`/sets/${s.id}`, { replace: true })} />
    </div>
  );
}
