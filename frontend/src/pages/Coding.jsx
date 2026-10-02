import { useState } from 'react';
import { Code2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { BANDS, bandLabel } from '../format';
import { Badge, Button, DiffBadge, Empty, ErrorNote, Loading, PageHead, Panel, useLoad, useUi } from '../ui';
import CodingEditor from '../components/CodingEditor';

export default function Coding() {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const admin = user.role === 'ADMIN';
  const [meta] = useLoad(() => api.get('/common/meta'));
  const [rows, loading, error, reload] = useLoad(() => api.get('/common/coding'));
  const [editing, setEditing] = useState(null);
  const canCreate = admin || (meta && !meta.settings.enforceAdminSets);
  const canEdit = (p) => admin || p.ownerEmpNo === user.id;

  const open = async (p) => {
    try { setEditing(await api.get(`/common/coding/${p.id}`)); } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async (p) => {
    if (!(await confirm({ title: `Remove “${p.title}”?`, message: 'It won’t be offered for new papers. Past reports keep their results.', confirmText: 'Remove', danger: true }))) return;
    try { await api.del(`/common/coding/${p.id}`); toast('Problem removed'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="stack">
      <PageHead title="Hands-on problems" subtitle="Live-coding tasks with a starter template and embedded tests. Candidates run the sample tests; hidden tests run at submission."
        actions={canCreate && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New problem</Button>} />
      <ErrorNote error={error} />
      {loading && !rows ? <Loading /> : rows?.length === 0 ? <Panel><Empty icon={Code2} title="No problems yet" /></Panel> : BANDS.map((b) => {
        const list = (rows || []).filter((p) => p.band === b);
        if (!list.length) return null;
        return (
          <Panel key={b} title={`${bandLabel(b)} band`} pad={false}>
            {list.map((p) => (
              <div key={p.id} className="set-row">
                <div>
                  <div className="row"><b style={{ cursor: 'pointer' }} onClick={() => open(p)}>{p.title}</b><DiffBadge d={p.difficulty} />{p.topic && <Badge>{p.topic}</Badge>}{!p.predefined && <Badge tone="info">My problem</Badge>}</div>
                  <div className="small muted mt8" style={{ maxWidth: '90ch' }}>{p.excerpt}</div>
                  <div className="tiny muted mt8">{p.testCount} tests ({p.hiddenCount} hidden), about {p.suggestedMinutes} min</div>
                </div>
                <div className="row nowrap">
                  {canEdit(p) ? <button className="icon-btn" title="Edit" onClick={() => open(p)}><Pencil size={16} /></button> : <Button size="sm" variant="ghost" onClick={() => open(p)}>View</Button>}
                  {canEdit(p) && <button className="icon-btn" title="Remove" onClick={() => remove(p)}><Trash2 size={16} /></button>}
                </div>
              </div>
            ))}
          </Panel>
        );
      })}
      {editing && <CodingEditor problem={editing.id ? editing : null} readOnly={!!editing.id && !canEdit(editing)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
