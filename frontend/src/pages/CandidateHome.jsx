import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Code2, ListChecks, LogOut, PlayCircle, UserRound } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { bandLabel, fmtDateTime } from '../format';
import { Button, ErrorNote, Field, Loading, Modal, StatusBadge, useLoad, useUi } from '../ui';

const EMPTY = { name: '', email: '', phone: '', totalExperience: '', currentCompany: '', currentRole: '', primarySkills: '', noticePeriod: '', location: '', education: '', summary: '' };

export default function CandidateHome() {
  const { user, logout, patch } = useAuth();
  const [data, loading, error, reload] = useLoad(() => api.get('/candidate/me'));
  const [editing, setEditing] = useState(false);
  const [startExam, setStartExam] = useState(null);

  useEffect(() => { if (data && !data.profile.profileCompleted) setEditing(true); }, [data]);

  if (loading && !data) return <Loading />;
  const profile = data?.profile;
  const exams = data?.exams || [];
  const open = exams.filter((e) => e.status === 'ASSIGNED' || e.status === 'IN_PROGRESS');
  const done = exams.filter((e) => e.status === 'SUBMITTED' || e.status === 'REVIEWED');

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="exam-bar" style={{ padding: '14px 28px' }}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 4h12M3 9h8M3 14h5" stroke="#E7C58B" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </div>
          <div className="brand-name">ExamDesk</div>
        </div>
        <div className="spacer" />
        <span className="small" style={{ color: '#a9c0bb' }}>{user.id}</span>
        <Button size="sm" variant="ghost" icon={LogOut} onClick={logout} style={{ color: '#fff' }}>Sign out</Button>
      </header>

      <div className="page" style={{ maxWidth: 980, margin: '0 auto' }}>
        <ErrorNote error={error} />
        {profile && (
          <>
            <div className="page-head">
              <div>
                <h1>{profile.profileCompleted ? `Welcome, ${profile.name?.split(' ')[0] || ''}` : 'Before you begin'}</h1>
                <p>{profile.profileCompleted
                  ? 'Your assigned assessments are below. Each one runs in a single sitting once you start it.'
                  : 'Fill in your profile. Your evaluator uses it alongside your results, and you need it to start an assessment.'}</p>
              </div>
              {profile.profileCompleted && !editing && <Button icon={UserRound} onClick={() => setEditing(true)}>Edit profile</Button>}
            </div>

            {editing ? (
              <ProfileForm profile={profile} onCancel={profile.profileCompleted ? () => setEditing(false) : null}
                onSaved={(d) => { setEditing(false); patch({ profileCompleted: true, name: d.profile.name }); reload(); }} />
            ) : (
              <div className="stack">
                <section className="panel">
                  <div className="panel-head"><h3>Assessments to take</h3></div>
                  {open.length === 0 ? (
                    <div className="empty"><ListChecks size={28} strokeWidth={1.5} /><h3>Nothing assigned yet</h3><p className="small">Your evaluator will assign an assessment. Check back here once you’ve been told it’s ready.</p></div>
                  ) : open.map((e) => (
                    <div className="set-row" key={e.id}>
                      <div>
                        <div className="row"><h3>{e.title}</h3><StatusBadge status={e.status} /></div>
                        <div className="row mt8 small muted" style={{ gap: 18 }}>
                          <span className="row" style={{ gap: 6 }}><ListChecks size={15} /> {e.questionCount} multiple-choice</span>
                          {e.codingCount > 0 && <span className="row" style={{ gap: 6 }}><Code2 size={15} /> {e.codingCount} hands-on</span>}
                          <span className="row" style={{ gap: 6 }}><Clock size={15} /> {e.durationMinutes ? `${e.durationMinutes} minutes` : 'Untimed'}</span>
                          <span>{bandLabel(e.band)} level</span>
                        </div>
                      </div>
                      <Button variant="primary" icon={PlayCircle} onClick={() => setStartExam(e)}>
                        {e.status === 'IN_PROGRESS' ? 'Resume' : 'Start'}
                      </Button>
                    </div>
                  ))}
                </section>

                {done.length > 0 && (
                  <section className="panel">
                    <div className="panel-head"><h3>Submitted</h3></div>
                    {done.map((e) => (
                      <div className="set-row" key={e.id}>
                        <div>
                          <h3>{e.title}</h3>
                          <div className="small muted mt8">Submitted {fmtDateTime(e.submittedAt)}</div>
                        </div>
                        <span className="badge pass"><CheckCircle2 size={14} /> Submitted</span>
                      </div>
                    ))}
                    <div className="panel-body small muted" style={{ borderTop: '1px solid var(--line)' }}>
                      Results go to your evaluator, who will contact you about next steps.
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {startExam && <StartModal exam={startExam} onClose={() => setStartExam(null)} />}
    </div>
  );
}

function ProfileForm({ profile, onSaved, onCancel }) {
  const { toast } = useUi();
  const [f, setF] = useState(() => ({ ...EMPTY, ...Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, v ?? ''])) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const payload = { ...f, totalExperience: f.totalExperience === '' ? null : Number(f.totalExperience) };
      const d = await api.put('/candidate/me', payload);
      toast('Profile saved');
      onSaved(d);
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  };

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">
        <div><h3>Your profile</h3><p>EP number {profile.epNo}. Fields marked * are required.</p></div>
      </div>
      <div className="panel-body grid g2">
        <Field label="Full name *"><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <Field label="Email *"><input className="input" type="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label="Total experience (years) *"><input className="input" type="number" min="0" max="50" step="0.5" value={f.totalExperience} onChange={set('totalExperience')} required /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Current company"><input className="input" value={f.currentCompany} onChange={set('currentCompany')} /></Field>
        <Field label="Current role"><input className="input" value={f.currentRole} onChange={set('currentRole')} /></Field>
        <Field label="Primary skills" hint="comma separated" className="span2">
          <input className="input" value={f.primarySkills} onChange={set('primarySkills')} placeholder="Java, Spring Boot, Microservices, Kafka, SQL" />
        </Field>
        <Field label="Notice period"><input className="input" value={f.noticePeriod} onChange={set('noticePeriod')} placeholder="e.g. 60 days" /></Field>
        <Field label="Current location"><input className="input" value={f.location} onChange={set('location')} /></Field>
        <Field label="Highest qualification" className="span2"><input className="input" value={f.education} onChange={set('education')} /></Field>
        <Field label="Short summary" hint="optional, up to 2000 characters" className="span2">
          <textarea className="textarea" maxLength={2000} value={f.summary} onChange={set('summary')} placeholder="Projects, domains and technologies you’ve worked with recently" />
        </Field>
        {error && <div className="span2"><ErrorNote error={error} /></div>}
      </div>
      <div className="modal-foot">
        {onCancel && <Button type="button" onClick={onCancel}>Cancel</Button>}
        <Button variant="primary" type="submit" busy={busy}>Save profile</Button>
      </div>
    </form>
  );
}

function StartModal({ exam, onClose }) {
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  const resume = exam.status === 'IN_PROGRESS';
  return (
    <Modal title={resume ? 'Resume assessment' : 'Before you start'} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>Not yet</Button>
        <Button variant="primary" icon={PlayCircle} disabled={!ok && !resume} onClick={() => nav(`/candidate/exam/${exam.id}`)}>
          {resume ? 'Resume now' : 'Start assessment'}
        </Button>
      </>}>
      <div className="stack">
        <div><b>{exam.title}</b></div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>{exam.durationMinutes ? <>You have <b>{exam.durationMinutes} minutes</b>. The timer keeps running if you close the window, and the paper is submitted automatically when it reaches zero.</> : 'This paper is untimed, but finish it in one sitting.'}</li>
          <li>Answers save automatically every few seconds. You can move between questions and flag ones to revisit.</li>
          {exam.codingCount > 0 && <li>Hands-on tasks run in a Java editor. Use <b>Run tests</b> to check the sample tests; hidden tests run when you submit.</li>}
          <li>Stay in this window. Switching tabs or apps is recorded and shared with your evaluator.</li>
          <li>Use your own knowledge: no search engines, AI tools or help from others.</li>
        </ul>
        {!resume && <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I’ve read the instructions and I’m ready</label>}
      </div>
    </Modal>
  );
}
