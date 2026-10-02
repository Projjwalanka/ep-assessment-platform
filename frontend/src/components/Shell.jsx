import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3, BookOpen, ClipboardList, Code2, FileUp, Layers, LogOut, Menu, Settings, Shuffle, Users, UserSquare2,
} from 'lucide-react';
import { useAuth } from '../auth';
import { initials } from '../format';

const NAV = {
  ADMIN: [
    { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: BarChart3 }, { to: '/reports', label: 'Evaluation reports', icon: ClipboardList }] },
    { title: 'People', items: [{ to: '/people', label: 'Candidates & evaluators', icon: Users }, { to: '/assignments', label: 'Candidate mapping', icon: Shuffle }] },
    { title: 'Content', items: [
      { to: '/questions', label: 'Question bank', icon: BookOpen }, { to: '/sets', label: 'Question sets', icon: Layers },
      { to: '/coding', label: 'Hands-on problems', icon: Code2 }, { to: '/import', label: 'Import questions', icon: FileUp }] },
    { title: 'System', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
  ],
  EVALUATOR: [
    { title: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: BarChart3 }, { to: '/my-candidates', label: 'My candidates', icon: UserSquare2 }] },
    { title: 'Content', items: [
      { to: '/sets', label: 'Question sets', icon: Layers }, { to: '/questions', label: 'Question bank', icon: BookOpen },
      { to: '/coding', label: 'Hands-on problems', icon: Code2 }] },
  ],
};

export default function Shell() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const groups = NAV[user.role] || [];
  return (
    <div className="app">
      <div className="mobile-bar no-print">
        <button className="icon-btn" style={{ color: '#fff' }} onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <b>ExamDesk</b>
      </div>
      <aside className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">
          <div className="brand-mark">
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3 4h12M3 9h8M3 14h5" stroke="#E7C58B" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </div>
          <div>
            <div className="brand-name">ExamDesk</div>
            <div className="brand-sub">Java back-end assessments</div>
          </div>
        </div>
        {groups.map((g) => (
          <nav className="nav-group" key={g.title} aria-label={g.title}>
            <div className="nav-title">{g.title}</div>
            {g.items.map((i) => (
              <NavLink key={i.to} to={i.to} className={({ isActive }) => `nav-link ${isActive || (i.to !== '/dashboard' && loc.pathname.startsWith(i.to)) ? 'active' : ''}`}>
                <i.icon size={17} strokeWidth={1.8} /> {i.label}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="sidebar-foot">
          <div className="who">
            <div className="avatar">{initials(user.name)}</div>
            <div>
              <div className="who-name">{user.name}</div>
              <div className="who-role">{user.role === 'ADMIN' ? 'Administrator' : `Evaluator ${user.id}`}</div>
            </div>
          </div>
          <button className="nav-link" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }} onClick={logout}>
            <LogOut size={17} strokeWidth={1.8} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="page"><Outlet /></div>
      </main>
    </div>
  );
}
