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

/** Redirect old /dashboard/:petId URLs to /pet/:petId */
function DashboardRedirect() {
  const { petId } = useParams();
  return <Navigate to={`/pet/${petId}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
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
