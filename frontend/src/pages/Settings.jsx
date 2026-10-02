import { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, Button, ErrorNote, Loading, PageHead, Panel, Switch, useLoad, useUi } from '../ui';

export default function SettingsPage() {
  const { toast } = useUi();
  const [data, loading, error, , setData] = useLoad(() => api.get('/admin/settings'));
  const [weight, setWeight] = useState(65);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setWeight(data.mcqWeight); }, [data]);

  const update = async (patch, message) => {
    setBusy(true);
    try { setData(await api.put('/admin/settings', patch)); toast(message || 'Settings saved'); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <PageHead title="Settings" subtitle="Rules that apply to every evaluator and every new submission." />
      <Panel title="Paper policy">
        <div className="stack">
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '60ch' }}>
              <b>Require admin-defined question sets</b>
              <p className="small muted mt8">Evaluators can only assign papers from admin sets, without changing them. They can’t build their own papers, write questions or create hands-on problems while this is on.</p>
            </div>
            <Switch checked={data.enforceAdminSets} disabled={busy} onChange={(v) => update({ enforceAdminSets: v }, v ? 'Evaluators now use admin sets only' : 'Evaluators can build their own papers')} />
          </div>
          <div className="row between" style={{ alignItems: 'flex-start', borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <div style={{ maxWidth: '60ch' }}>
              <b>Let evaluators write questions</b>
              <p className="small muted mt8">Evaluators can add their own questions to papers and choose to contribute them to the master bank.</p>
            </div>
            <Switch checked={data.allowEvaluatorQuestions} disabled={busy || data.enforceAdminSets} onChange={(v) => update({ allowEvaluatorQuestions: v })} />
          </div>
        </div>
      </Panel>

      <Panel title="Scoring" subtitle="Applies to papers submitted from now on. Existing reports keep their scores.">
        <div className="stack">
          <div className="row" style={{ gap: 16 }}>
            <span className="small" style={{ width: 120 }}>MCQ <b>{weight}%</b></span>
            <input type="range" min="0" max="100" step="5" value={weight} onChange={(e) => setWeight(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} aria-label="MCQ weight" />
            <span className="small" style={{ width: 130, textAlign: 'right' }}>Hands-on <b>{100 - weight}%</b></span>
          </div>
          <p className="small muted">When a paper has hands-on tasks, the overall score blends the difficulty-weighted MCQ score and the share of tests passed in this ratio. Papers without hands-on tasks use the MCQ score alone.</p>
          <div className="row"><Button variant="primary" disabled={weight === data.mcqWeight} busy={busy} onClick={() => update({ mcqWeight: weight }, 'Scoring weight saved')}>Save weight</Button></div>
        </div>
      </Panel>

      <Panel title="Technologies">
        <div className="stack">
          {data.technologies.map((t) => (
            <div key={t.code} className="row between">
              <div><b>{t.name}</b></div>
              {t.enabled ? <Badge tone="pass">Enabled</Badge> : <Badge>Planned</Badge>}
            </div>
          ))}
          <p className="small muted">This release covers Java back-end. UI and QA tracks will reuse the same question bank, sets and reports when they’re added.</p>
        </div>
      </Panel>
    </div>
  );
}
