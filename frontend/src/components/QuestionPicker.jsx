import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';
import { BANDS, bandLabel, DIFFS, diffLabel } from '../format';
import { Button, DiffBadge, Loading, Modal, useLoad } from '../ui';

/** Browse the bank and tick questions to add. Already-chosen questions are shown as added. */
export default function QuestionPicker({ exclude = [], defaultBand, onClose, onPick }) {
  const [all, loading] = useLoad(() => api.get('/common/questions'));
  const [band, setBand] = useState(defaultBand || '');
  const [topic, setTopic] = useState('');
  const [diff, setDiff] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const topics = useMemo(() => [...new Set((all || []).map((x) => x.topic))].sort(), [all]);
  const rows = useMemo(() => (all || []).filter((x) =>
    (!band || x.band === band) && (!topic || x.topic === topic) && (!diff || x.difficulty === diff) &&
    (!q || x.text.toLowerCase().includes(q.toLowerCase()))), [all, band, topic, diff, q]);
  const toggle = (x) => setPicked((p) => (p.some((y) => y.id === x.id) ? p.filter((y) => y.id !== x.id) : [...p, x]));

  return (
    <Modal title="Add questions from the bank" size="xwide" onClose={onClose}
      footer={<><span className="muted small" style={{ marginRight: 'auto' }}>{picked.length} selected</span><Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!picked.length} onClick={() => onPick(picked)}>Add {picked.length || ''} question{picked.length === 1 ? '' : 's'}</Button></>}>
      <div className="row" style={{ marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search question text" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" style={{ width: 140 }} value={band} onChange={(e) => setBand(e.target.value)}><option value="">All bands</option>{BANDS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}</select>
        <select className="select" style={{ width: 180 }} value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{topics.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="select" style={{ width: 140 }} value={diff} onChange={(e) => setDiff(e.target.value)}><option value="">Any difficulty</option>{DIFFS.map((d) => <option key={d} value={d}>{diffLabel(d)}</option>)}</select>
      </div>
      {loading ? <Loading /> : (
        <div className="panel" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {rows.length === 0 && <div className="empty small">No questions match these filters.</div>}
          {rows.map((x) => {
            const already = exclude.includes(x.id);
            const on = picked.some((y) => y.id === x.id);
            return (
              <label key={x.id} className="q-item" style={{ cursor: already ? 'default' : 'pointer', opacity: already ? 0.55 : 1, background: on ? 'var(--accent-soft)' : undefined }}>
                <input type="checkbox" disabled={already} checked={on || already} onChange={() => toggle(x)} style={{ accentColor: 'var(--accent)', marginTop: 3 }} />
                <div>
                  <div className="qt">{x.text}</div>
                  <div className="q-meta"><span className="badge">{x.topic}</span><DiffBadge d={x.difficulty} /><span className="badge">{bandLabel(x.band)}</span>{!x.master && <span className="badge info">Private</span>}{already && <span className="badge accent">Already in paper</span>}</div>
                </div>
                <span />
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
