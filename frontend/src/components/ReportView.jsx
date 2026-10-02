import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CircleCheck, CircleX, Info, Printer } from 'lucide-react';
import { api } from '../api';
import { bandLabel, DECISION, fmtDate, fmtDateTime, fmtDuration, letter, pct, scoreColor } from '../format';
import { Badge, Button, DecisionBadge, DiffBadge, Field, Panel, RecBadge, ScoreBar, Segmented, StatusBadge, useUi } from '../ui';
import { Gauge, TopicBars, TopicRadar } from './Charts';

const VERDICT_TONE = { Validated: 'pass', 'Partly shown': 'amber', 'Not demonstrated': 'fail', 'Not assessed': '' };
const FLAG_ICON = { high: <AlertTriangle size={17} color="var(--fail)" />, medium: <AlertTriangle size={17} color="var(--amber)" />, low: <Info size={17} color="var(--info)" /> };

export default function ReportView({ data, onReviewed }) {
  const { summary, report, review, history } = data;
  const s = report.scores;
  const a = report.analysis;
  const c = report.candidate;
  const e = report.exam;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="row"><h1>{c.name || c.epNo}</h1><StatusBadge status={summary.status} /><DecisionBadge decision={review.decision} /></div>
          <p>{c.epNo}, {e.title}, submitted {fmtDateTime(e.submittedAt)}</p>
        </div>
        <div className="row no-print">
          <Button icon={Printer} onClick={() => window.print()}>Print or save as PDF</Button>
        </div>
      </div>

      <section className="panel verdict">
        <div className="verdict-gauge">
          <Gauge value={s.recommendationScore} bar={a.experienceFit?.bar} />
          <div className="tiny muted" style={{ textAlign: 'center', marginTop: 4 }}>Mark shows the expected bar for the {bandLabel(e.band)} band</div>
        </div>
        <div className="verdict-body">
          <div className="row">
            <span className="verdict-label" style={{ color: scoreColor(s.recommendationScore) }}>{s.recommendation}</span>
            <Badge tone={a.experienceFit?.verdict?.startsWith('Well') || a.experienceFit?.verdict?.startsWith('Meets') ? 'pass' : 'amber'}>{a.experienceFit?.verdict}</Badge>
          </div>
          <p style={{ maxWidth: '75ch' }}>{a.summary}</p>
          <div className="score-pills">
            <div className="score-pill"><div className="v">{pct(s.overallPercent)}</div><div className="l">Overall</div></div>
            <div className="score-pill"><div className="v">{pct(s.mcqPercent)}</div><div className="l">MCQ ({s.mcqCorrect}/{s.mcqTotal} correct)</div></div>
            <div className="score-pill"><div className="v">{pct(s.weightedPercent)}</div><div className="l">Difficulty-weighted</div></div>
            {s.codingPercent != null && <div className="score-pill"><div className="v">{pct(s.codingPercent)}</div><div className="l">Hands-on tests</div></div>}
            <div className="score-pill"><div className="v">{fmtDuration(e.timeTakenSeconds)}</div><div className="l">Time taken{e.durationMinutes ? ` of ${e.durationMinutes} min` : ''}</div></div>
          </div>
          <ScoreComponents s={s} mcqWeight={e.mcqWeight} />
        </div>
      </section>

      <div className="grid g2">
        <Panel title="Topic profile" subtitle="Share of questions answered correctly in each topic">
          <TopicRadar data={report.topics} />
        </Panel>
        <Panel title="Analysis">
          <div className="stack">
            <div>
              <div className="small muted">Strengths</div>
              <div className="chips mt8">{a.strengths.length ? a.strengths.map((t) => <Badge key={t} tone="pass">{t}</Badge>) : <span className="small muted">No topic reached 75% with at least two questions.</span>}</div>
            </div>
            <div>
              <div className="small muted">Needs improvement</div>
              <div className="chips mt8">{a.improvements.length ? a.improvements.map((t) => <Badge key={t} tone="fail">{t}</Badge>) : <span className="small muted">No topic scored below 50%.</span>}</div>
            </div>
            <div>
              <div className="small muted">By difficulty</div>
              <div className="stack mt8" style={{ gap: 6 }}>
                {report.difficulty.map((d) => (
                  <div key={d.difficulty} className="row" style={{ gap: 12 }}>
                    <span style={{ width: 70 }}><DiffBadge d={d.difficulty} /></span>
                    <div style={{ flex: 1 }}><ScoreBar value={d.percent} /></div>
                    <span className="small muted nowrap">{d.correct}/{d.total}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="small muted">{a.timeEfficiency?.text}</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid g2">
        <Panel title="Observations" subtitle={a.flags.length ? `${a.flags.length} item${a.flags.length > 1 ? 's' : ''} to be aware of` : undefined}>
          {a.flags.length === 0
            ? <div className="row small"><CircleCheck size={17} color="var(--pass)" /> Nothing unusual in how the paper was taken.</div>
            : a.flags.map((f, i) => <div key={i} className="flag">{FLAG_ICON[f.level]}<span>{f.text}</span></div>)}
        </Panel>
        <Panel title="Claimed skills checked against results" subtitle="Skills from the profile mapped to tested topics; 60% or more counts as validated">
          {a.skillClaims.length === 0 ? <div className="small muted">The candidate didn’t list skills that map to tested topics.</div> : (
            <table className="table">
              <thead><tr><th>Skill</th><th>Tested as</th><th className="num">Score</th><th>Result</th></tr></thead>
              <tbody>
                {a.skillClaims.map((k) => (
                  <tr key={k.skill}><td>{k.skill}</td><td className="muted">{k.topic}</td><td className="num">{pct(k.percent)}</td><td><Badge tone={VERDICT_TONE[k.verdict]}>{k.verdict}</Badge></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="grid g2">
        <Panel title="Candidate profile">
          <dl className="kv">
            <dt>EP number</dt><dd>{c.epNo}</dd>
            <dt>Experience</dt><dd>{c.totalExperience != null ? `${c.totalExperience} years` : '—'} (paper set for {bandLabel(e.band)})</dd>
            <dt>Current role</dt><dd>{[c.currentRole, c.currentCompany].filter(Boolean).join(' at ') || '—'}</dd>
            <dt>Skills</dt><dd>{c.primarySkills || '—'}</dd>
            <dt>Location</dt><dd>{c.location || '—'}</dd>
            <dt>Notice period</dt><dd>{c.noticePeriod || '—'}</dd>
            <dt>Education</dt><dd>{c.education || '—'}</dd>
            <dt>Email</dt><dd>{c.email || '—'}</dd>
            <dt>Phone</dt><dd>{c.phone || '—'}</dd>
            {c.summary && <><dt>Summary</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{c.summary}</dd></>}
          </dl>
        </Panel>
        <ReviewPanel examId={summary.id} review={review} status={summary.status} onReviewed={onReviewed} />
      </div>

      <Panel title="Topic scores">
        <TopicBars data={report.topics} />
      </Panel>

      {report.coding.length > 0 && <CodingSection coding={report.coding} />}

      <QuestionReview questions={report.questions} />

      {history?.length > 1 && (
        <Panel title="Assessment history" subtitle="Every paper this candidate has been assigned" pad={false}>
          <HistoryTable rows={history} currentId={summary.id} />
        </Panel>
      )}
      <div className="tiny muted">Report generated {fmtDateTime(report.generatedAt)}. Scores are frozen at submission; later edits to questions don’t change this report.</div>
    </div>
  );
}

function ScoreComponents({ s, mcqWeight }) {
  const c = s.components || {};
  return (
    <div className="small muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      How the recommendation score is built: 85% performance ({pct(c.performance)}, MCQ weighted {mcqWeight}%
      {s.codingPercent != null ? ` and hands-on ${100 - mcqWeight}%` : ''}), 10% skill-claim consistency ({pct(c.skillConsistency)}),
      5% completion ({pct(c.completion)}){c.integrityPenalty ? `, minus ${c.integrityPenalty} for repeated window switching` : ''}.
    </div>
  );
}

function ReviewPanel({ examId, review, status, onReviewed }) {
  const { toast } = useUi();
  const [decision, setDecision] = useState(review.decision || 'PROCEED');
  const [notes, setNotes] = useState(review.notes || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.put(`/common/exams/${examId}/review`, { decision, notes }); toast('Review saved'); onReviewed?.(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy(false); }
  };
  return (
    <Panel title="Evaluator decision" subtitle={review.reviewedBy ? `Last updated by ${review.reviewedBy} on ${fmtDate(review.reviewedAt)}` : 'Record your decision and notes for the hiring team'}>
      <div className="stack no-print">
        <Segmented value={decision} onChange={setDecision} options={Object.entries(DECISION).map(([k, v]) => ({ value: k, label: v.label }))} />
        <Field label="Notes">
          <textarea className="textarea" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stood out, what to probe in the next round…" />
        </Field>
        <div className="row"><Button variant="primary" busy={busy} onClick={save}>{status === 'REVIEWED' ? 'Update decision' : 'Save decision'}</Button></div>
      </div>
      <div className="print-block">
        <b>{DECISION[review.decision]?.label || 'No decision yet'}</b>
        {review.notes && <p style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{review.notes}</p>}
      </div>
    </Panel>
  );
}

function CodingSection({ coding }) {
  const [open, setOpen] = useState(coding[0]?.problemId);
  const p = coding.find((x) => x.problemId === open) || coding[0];
  return (
    <Panel title="Hands-on results" subtitle="All tests, including hidden ones, run at submission" actions={coding.length > 1 && (
      <Segmented value={p.problemId} onChange={setOpen} options={coding.map((x, i) => ({ value: x.problemId, label: `Task ${i + 1}` }))} />
    )}>
      <div className="stack">
        <div className="row">
          <h3>{p.title}</h3><DiffBadge d={p.difficulty} />
          <Badge tone={p.percent >= 80 ? 'pass' : p.percent >= 50 ? 'amber' : 'fail'}>{p.passed}/{p.total} tests passed</Badge>
          {!p.attempted && <Badge>Starter code unchanged</Badge>}
          {p.attempted && !p.compiled && <Badge tone="fail">Did not compile</Badge>}
        </div>
        <div className="grid g2">
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>Submitted code</div>
            <pre className="code-view">{p.code || '// no code submitted'}</pre>
            {p.compileErrors && p.compileErrors !== 'Not run' && <pre className="code-view mt8" style={{ color: '#f4b7aa', maxHeight: 180 }}>{p.compileErrors}</pre>}
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>Tests</div>
            <div className="tests">
              {p.tests.map((t) => (
                <div key={t.name} className="test-row">
                  {t.passed ? <CircleCheck size={17} color="var(--pass)" /> : <CircleX size={17} color="var(--fail)" />}
                  <div>
                    <div>{t.name} {t.hidden && <Badge>hidden</Badge>}</div>
                    {!t.passed && <div className="detail">{t.error || `expected ${t.expected}, got ${t.actual}`}</div>}
                  </div>
                  <span className="tiny muted">{t.millis} ms</span>
                </div>
              ))}
              {p.tests.length === 0 && <div className="small muted">No test results were recorded.</div>}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function QuestionReview({ questions }) {
  const [filter, setFilter] = useState('all');
  const rows = useMemo(() => questions.filter((q) =>
    filter === 'all' || (filter === 'wrong' && q.selectedIndex != null && !q.correct) || (filter === 'skipped' && q.selectedIndex == null) || (filter === 'right' && q.correct)), [questions, filter]);
  const counts = {
    right: questions.filter((q) => q.correct).length,
    wrong: questions.filter((q) => q.selectedIndex != null && !q.correct).length,
    skipped: questions.filter((q) => q.selectedIndex == null).length,
  };
  return (
    <Panel title="Answer review" actions={
      <Segmented value={filter} onChange={setFilter} options={[
        { value: 'all', label: `All ${questions.length}` }, { value: 'right', label: `Correct ${counts.right}` },
        { value: 'wrong', label: `Wrong ${counts.wrong}` }, { value: 'skipped', label: `Skipped ${counts.skipped}` }]} />
    }>
      {rows.length === 0 && <div className="small muted">No questions in this view.</div>}
      {rows.map((q) => (
        <div key={q.id} className="q-review">
          <div className="row">
            <span className="small muted">Q{questions.indexOf(q) + 1}</span>
            <Badge>{q.topic}</Badge><DiffBadge d={q.difficulty} />
            {q.correct ? <Badge tone="pass">Correct</Badge> : q.selectedIndex == null ? <Badge>Not answered</Badge> : <Badge tone="fail">Wrong</Badge>}
          </div>
          <div className="q-text">{q.text}</div>
          {q.options.map((o, i) => (
            <div key={i} className={`opt-line ${i === q.correctIndex ? 'correct' : i === q.selectedIndex ? 'wrong' : ''}`}>
              <span className="opt-key">{letter(i)}</span>
              <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{o}</span>
              {i === q.selectedIndex && <span className="tiny">candidate’s answer</span>}
            </div>
          ))}
          {q.explanation && <div className="small muted mt8">{q.explanation}</div>}
        </div>
      ))}
    </Panel>
  );
}

export function HistoryTable({ rows, currentId }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Paper</th><th>Status</th><th>Submitted</th><th>Overall</th><th>Recommendation</th><th>Decision</th><th /></tr></thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id} style={h.id === currentId ? { background: '#f7faf8' } : undefined}>
              <td><div className="cell-main">{h.title}</div><div className="cell-sub">{bandLabel(h.band)}, by {h.evaluatorName || '—'}</div></td>
              <td><StatusBadge status={h.status} /></td>
              <td className="nowrap">{fmtDate(h.submittedAt)}</td>
              <td style={{ minWidth: 140 }}>{h.totalScore != null ? <ScoreBar value={h.totalScore} /> : <span className="muted">—</span>}</td>
              <td><RecBadge label={h.recommendation} /></td>
              <td><DecisionBadge decision={h.reviewDecision} /></td>
              <td className="right">{h.id !== currentId && (h.status === 'SUBMITTED' || h.status === 'REVIEWED') && <Link to={`/report/${h.id}`}>Open</Link>}{h.id === currentId && <span className="tiny muted">this report</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

