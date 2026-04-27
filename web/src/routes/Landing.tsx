import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { AuthForm } from '../components/AuthForm';

/**
 * Simple state machine:
 *   - Loading auth → spinner
 *   - No user      → AuthForm
 *   - User         → Navigate to /register
 *
 * The disclaimer flow was temporarily disabled — the Disclaimer component
 * and useDisclaimer hook still exist and will be wired back in later.
 * ensureUserProfile is now called from PetForm on first pet registration.
 */
export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      </Layout>
    );
  }

  if (user) {
    return <Navigate to="/register" replace />;
  }

  return (
    <Layout>
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-gray-900 mb-3">
          Tu mascota, siempre protegida
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          Veterinario con IA por WhatsApp y un código QR de emergencia que
          puede salvarle la vida a tu mascota si se pierde.
        </p>
      </div>
      <AuthForm />
    </Layout>
  );
}
