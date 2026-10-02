import { useEffect, useState } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth';
import { Button, ErrorNote, Field } from '../ui';

const ROLES = {
  CANDIDATE: { label: 'Candidate', id: 'EP number', idPh: 'e.g. EP10001', pwd: 'Access code', pwdPh: 'From your invitation', demo: ['EP10001', 'WELCOME1'] },
  EVALUATOR: { label: 'Evaluator', id: 'Employee number', idPh: 'e.g. E1001', pwd: 'Password', pwdPh: '', demo: ['E1001', 'Eval@123'] },
  ADMIN: { label: 'Admin', id: 'Username', idPh: 'admin', pwd: 'Password', pwdPh: '', demo: ['admin', 'Admin@123'] },
};

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState('CANDIDATE');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  useEffect(() => { api.get('/health').then(setHealth).catch(() => {}); }, []);
  const r = ROLES[role];
  const showDemo = health?.demo && (role !== 'ADMIN' || health.defaultAdmin);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const me = await login(role, loginId.trim(), password);
      nav(me.role === 'CANDIDATE' ? '/candidate' : '/dashboard', { replace: true });
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-art">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 4h12M3 9h8M3 14h5" stroke="#E7C58B" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </div>
          <div className="brand-name">ExamDesk</div>
        </div>
        <div>
          <h1>Technical assessments for Java back-end hiring</h1>
          <p>Multiple-choice rounds and live coding in one place, with a scored profile for every candidate.</p>
          <div className="login-flow">
            <div className="flow-step"><div className="flow-num">1</div><div><b>Admin maps candidates</b><span>to evaluators and curates question sets by experience band</span></div></div>
            <div className="flow-step"><div className="flow-num">2</div><div><b>Evaluator sets the paper</b><span>from a template, auto-generated, or hand-picked, with hands-on tasks</span></div></div>
            <div className="flow-step"><div className="flow-num">3</div><div><b>Candidate takes the test</b><span>timed MCQs and a coding editor with built-in tests</span></div></div>
            <div className="flow-step"><div className="flow-num">4</div><div><b>Report and recommendation</b><span>topic scores, skill checks and a 0–100 recommendation score</span></div></div>
          </div>
        </div>
        <div className="tiny" style={{ color: '#6f8c87' }}>Internal use only. Activity during assessments is recorded.</div>
      </div>

      <div className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="muted">Choose how you’re signing in.</p>
          <div className="role-tabs" role="tablist">
            {Object.entries(ROLES).map(([k, v]) => (
              <button type="button" key={k} role="tab" aria-selected={role === k} className={role === k ? 'on' : ''}
                onClick={() => { setRole(k); setError(null); setLoginId(''); setPassword(''); }}>{v.label}</button>
            ))}
          </div>
          <div className="stack">
            <Field label={r.id}>
              <input className="input" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder={r.idPh}
                autoComplete="username" autoCapitalize="characters" required />
            </Field>
            <Field label={r.pwd}>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={r.pwdPh} autoComplete="current-password" required />
            </Field>
            <ErrorNote error={error} />
            <Button variant="primary" size="lg" type="submit" busy={busy} icon={LogIn}>Sign in</Button>
          </div>
          {showDemo && <div className="demo">
            Demo data is loaded. {r.label} demo login: <b>{r.demo[0]}</b> / <b>{r.demo[1]}</b>{' '}
            <button type="button" onClick={() => { setLoginId(r.demo[0]); setPassword(r.demo[1]); }}>Fill in</button>
          </div>}
        </form>
      </div>
    </div>
  );
}
