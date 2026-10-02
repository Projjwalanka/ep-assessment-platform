import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { BANDS, bandLabel, DIFFS, diffLabel, letter } from '../format';
import { Badge, Button, DiffBadge, Empty, ErrorNote, Loading, PageHead, Panel, useLoad, useUi } from '../ui';
import QuestionEditor from '../components/QuestionEditor';

const PAGE = 40;

export default function Questions() {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const admin = user.role === 'ADMIN';
  const [meta] = useLoad(() => api.get('/common/meta'));
  const [all, loading, error, reload] = useLoad(() => api.get('/common/questions'));
  const [band, setBand] = useState('');
  const [topic, setTopic] = useState('');
  const [diff, setDiff] = useState('');
  const [scope, setScope] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [limit, setLimit] = useState(PAGE);

  const settings = meta?.settings;
  const canWrite = admin || (settings && settings.allowEvaluatorQuestions && !settings.enforceAdminSets);
  const rows = useMemo(() => (all || []).filter((x) =>
    (!band || x.band === band) && (!topic || x.topic === topic) && (!diff || x.difficulty === diff) &&
    (scope === 'all' || (scope === 'mine' && x.createdBy === user.id) || (scope === 'master' && x.master) || (scope === 'imported' && x.source === 'IMPORT')) &&
    (!q || x.text.toLowerCase().includes(q.toLowerCase()))), [all, band, topic, diff, scope, q, user.id]);
  const canEdit = (x) => admin || x.createdBy === user.id;

  const remove = async (x) => {
    if (!(await confirm({ title: 'Remove this question?', message: 'It will no longer be offered for new papers. Reports and existing papers that used it are unaffected.', confirmText: 'Remove', danger: true }))) return;
    try { await api.del(`/common/questions/${x.id}`); toast('Question removed'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="stack">
      <PageHead title="Question bank" subtitle={admin ? 'The master bank every paper draws from. Add questions one at a time or import a file.' : 'Master questions plus any private questions you’ve written.'}
        actions={canWrite && <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New question</Button>} />
      <ErrorNote error={error} />
      <Panel pad={false}>
        <div className="panel-head" style={{ flexWrap: 'wrap' }}>
          <div className="row" style={{ flex: 1 }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
              <input className="input" style={{ paddingLeft: 32 }} placeholder="Search question text" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
            </div>
            <select className="select" style={{ width: 130 }} value={band} onChange={(e) => setBand(e.target.value)}><option value="">All bands</option>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select>
            <select className="select" style={{ width: 170 }} value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{(meta?.topics || []).map((t) => <option key={t}>{t}</option>)}</select>
            <select className="select" style={{ width: 140 }} value={diff} onChange={(e) => setDiff(e.target.value)}><option value="">Any difficulty</option>{DIFFS.map((d) => <option key={d} value={d}>{diffLabel(d)}</option>)}</select>
            <select className="select" style={{ width: 150 }} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">All visible</option><option value="master">Master bank</option><option value="mine">Written by me</option>{admin && <option value="imported">Imported</option>}
            </select>
          </div>
          <span className="small muted">{rows.length} question{rows.length === 1 ? '' : 's'}</span>
        </div>
        {loading && !all ? <Loading /> : rows.length === 0 ? <Empty title="No questions match">Clear a filter or add a new question.</Empty> : (
          <>
            {rows.slice(0, limit).map((x) => (
              <div key={x.id} className="q-item" style={{ gridTemplateColumns: '24px 1fr auto' }}>
                <button className="icon-btn" onClick={() => setOpen(open === x.id ? null : x.id)} aria-label="Show options">{open === x.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                <div>
                  <div className={open === x.id ? '' : 'qt'} style={{ whiteSpace: open === x.id ? 'pre-wrap' : undefined, cursor: 'pointer' }} onClick={() => setOpen(open === x.id ? null : x.id)}>{x.text}</div>
                  <div className="q-meta">
                    <Badge>{x.topic}</Badge><DiffBadge d={x.difficulty} /><Badge>{bandLabel(x.band)}</Badge>
                    {!x.master && <Badge tone="info">Private</Badge>}
                    {x.source === 'IMPORT' && <Badge tone="amber">Imported</Badge>}
                    {x.source === 'EVALUATOR' && x.master && <Badge tone="accent">By {x.createdBy}</Badge>}
                  </div>
                  {open === x.id && (
                    <div className="mt8">
                      {x.options.map((o, i) => (
                        <div key={i} className={`opt-line ${i === x.correctIndex ? 'correct' : ''}`}><span className="opt-key">{letter(i)}</span><span style={{ whiteSpace: 'pre-wrap' }}>{o}</span></div>
                      ))}
                      {x.explanation && <div className="small muted mt8">{x.explanation}</div>}
                    </div>
                  )}
                </div>
                <div className="row nowrap" style={{ gap: 2 }}>
                  {canEdit(x) && <button className="icon-btn" title="Edit" onClick={() => setEditing(x)}><Pencil size={16} /></button>}
                  {canEdit(x) && (admin || !x.master) && <button className="icon-btn" title="Remove" onClick={() => remove(x)}><Trash2 size={16} /></button>}
                </div>
              </div>
            ))}
            {rows.length > limit && <div className="panel-body" style={{ textAlign: 'center' }}><Button onClick={() => setLimit(limit + PAGE)}>Show more ({rows.length - limit} left)</Button></div>}
          </>
        )}
      </Panel>
      {editing && <QuestionEditor question={editing.id ? editing : null} topics={meta?.topics} defaultBand={band} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}
