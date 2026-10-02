import { Link, useNavigate } from 'react-router-dom';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { bandLabel, fmtDate } from '../format';
import { Badge, Empty, ErrorNote, Loading, PageHead, Panel, useLoad, useUi } from '../ui';
import { MixBar } from '../components/Charts';

export default function Sets() {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const nav = useNavigate();
  const admin = user.role === 'ADMIN';
  const [meta] = useLoad(() => api.get('/common/meta'));
  const [sets, loading, error, reload] = useLoad(() => api.get('/common/sets'));
  const enforce = !admin && meta?.settings?.enforceAdminSets;
  const adminSets = (sets || []).filter((s) => s.adminDefined);
  const mine = (sets || []).filter((s) => !s.adminDefined);

  const remove = async (s, e) => {
    e.stopPropagation();
    if (!(await confirm({ title: `Delete “${s.name}”?`, message: 'Papers already assigned from this set are not affected.', confirmText: 'Delete', danger: true }))) return;
    try { await api.del(`/common/sets/${s.id}`); toast('Set deleted'); reload(); } catch (err) { toast(err.message, 'error'); }
  };

  const list = (rows, canDelete) => rows.map((s) => (
    <div key={s.id} className="set-row" style={{ cursor: 'pointer' }} onClick={() => nav(`/sets/${s.id}`)}>
      <div>
        <div className="row"><b>{s.name}</b><Badge>{bandLabel(s.band)}</Badge></div>
        {s.description && <div className="small muted mt8" style={{ maxWidth: '80ch' }}>{s.description}</div>}
        <div className="tiny muted mt8">{s.questionCount} questions, {s.codingCount} hands-on, {s.durationMinutes ? `${s.durationMinutes} min` : 'untimed'}, updated {fmtDate(s.updatedAt)}</div>
      </div>
      <div className="row nowrap">
        <MixBar mix={s.difficultyMix} />
        {canDelete && <button className="icon-btn" onClick={(e) => remove(s, e)} aria-label="Delete set"><Trash2 size={16} /></button>}
      </div>
    </div>
  ));

  return (
    <div className="stack">
      <PageHead title="Question sets" subtitle={admin ? 'Predefined papers evaluators can assign as they are or adapt. Generate one from a count and band, then edit it.' : 'Admin sets are ready to use. Your own templates are visible only to you.'}
        actions={!enforce && <Link className="btn primary" to="/sets/new"><Plus size={16} /> {admin ? 'New admin set' : 'New template'}</Link>} />
      <ErrorNote error={error} />
      {loading && !sets ? <Loading /> : (
        <>
          <Panel title="Admin sets" subtitle="The bar line shows the easy, medium and hard mix" pad={false}>
            {adminSets.length ? list(adminSets, admin) : <Empty icon={Layers} title="No admin sets yet" />}
          </Panel>
          {(!admin || mine.length > 0) && (
            <Panel title={admin ? 'Evaluator templates' : 'My templates'} pad={false}>
              {mine.length ? list(mine, true) : <Empty icon={Layers} title="No templates yet">{enforce ? 'Your admin requires admin sets, so personal templates are turned off.' : 'Build one from scratch, or open an admin set and save a copy.'}</Empty>}
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
