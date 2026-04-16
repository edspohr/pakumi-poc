import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDisclaimer } from '../hooks/useDisclaimer';
import { Layout } from '../components/Layout';
import { PetForm } from '../components/PetForm';

export default function Register() {
  const { user, loading } = useAuth();
  const { accepted, loading: disclaimerLoading } = useDisclaimer(user?.uid);

  if (loading || (user && disclaimerLoading)) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      </Layout>
    );
  }

  if (!user || !accepted) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Registra a tu mascota</h2>
        <p className="text-gray-600 text-sm">
          Esta información ayudará al veterinario IA y se mostrará en el
          perfil de emergencia si tu mascota se pierde.
        </p>
      </div>
      <PetForm />
    </Layout>
  );
}
