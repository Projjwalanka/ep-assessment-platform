import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Loading } from './ui';
import Shell from './components/Shell';
import Login from './pages/Login';
import CandidateHome from './pages/CandidateHome';
import ExamRunner from './pages/ExamRunner';
import AdminDashboard from './pages/AdminDashboard';
import EvaluatorDashboard from './pages/EvaluatorDashboard';
import MyCandidates from './pages/MyCandidates';
import Questions from './pages/Questions';
import Sets from './pages/Sets';
import SetEdit from './pages/SetEdit';
import Coding from './pages/Coding';
import Assign from './pages/Assign';
import Report from './pages/Report';
import ImportPage from './pages/Import';
import People from './pages/People';
import Assignments from './pages/Assignments';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading text="Starting ExamDesk…" />;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  if (user.role === 'CANDIDATE') {
    return (
      <Routes>
        <Route path="/candidate" element={<CandidateHome />} />
        <Route path="/candidate/exam/:id" element={<ExamRunner />} />
        <Route path="*" element={<Navigate to="/candidate" replace />} />
      </Routes>
    );
  }
  const admin = user.role === 'ADMIN';
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/dashboard" element={admin ? <AdminDashboard /> : <EvaluatorDashboard />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/sets" element={<Sets />} />
        <Route path="/sets/new" element={<SetEdit />} />
        <Route path="/sets/:id" element={<SetEdit />} />
        <Route path="/coding" element={<Coding />} />
        <Route path="/assign/:ep" element={<Assign />} />
        <Route path="/report/:id" element={<Report />} />
        {admin && <Route path="/import" element={<ImportPage />} />}
        {admin && <Route path="/people" element={<People />} />}
        {admin && <Route path="/assignments" element={<Assignments />} />}
        {admin && <Route path="/reports" element={<Reports />} />}
        {admin && <Route path="/settings" element={<SettingsPage />} />}
        {!admin && <Route path="/my-candidates" element={<MyCandidates />} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
