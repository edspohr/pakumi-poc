import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Landing from './routes/Landing';
import Register from './routes/Register';
import Emergency from './routes/Emergency';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './routes/Dashboard';
import History from './routes/History';
import Grooming from './routes/Grooming';
import RemindersPage from './routes/RemindersPage';
import Settings from './routes/Settings';
import { useAuth } from './hooks/useAuth';
import { useDisclaimer } from './hooks/useDisclaimer';
import { Disclaimer } from './components/Disclaimer';

/** Redirect old /dashboard/:petId URLs to /pet/:petId */
function DashboardRedirect() {
  const { petId } = useParams();
  return <Navigate to={`/pet/${petId}`} replace />;
}

/** Global guard to enforce the data protection disclaimer for all logged-in users */
function GlobalDisclaimer() {
  const { user, loading: authLoading } = useAuth();
  const { accepted, loading: discLoading, accept } = useDisclaimer(user?.uid);

  if (authLoading || discLoading || !user || accepted) return null;

  // The modal covers the screen and forces acceptance before proceeding
  return <Disclaimer onAccept={accept} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalDisclaimer />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/emergency/:petId" element={<Emergency />} />

        {/* Backward compat */}
        <Route path="/dashboard/:petId" element={<DashboardRedirect />} />

        {/* Pet dashboard — nested routes with shared layout */}
        <Route path="/pet/:petId" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="history" element={<History />} />
          <Route path="grooming" element={<Grooming />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
