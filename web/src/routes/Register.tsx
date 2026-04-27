import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getUserPets } from '../lib/firestore';
import { Layout } from '../components/Layout';
import { PetForm } from '../components/PetForm';

export default function Register() {
  const { user, loading } = useAuth();
  const petsChecked = useRef(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [petsLoading, setPetsLoading] = useState(true);

  // Once auth resolves, look up existing pets. If the user already has
  // one, skip the form and route them to that pet's dashboard. Guarded by
  // a ref so this latches exactly once per mount.
  useEffect(() => {
    if (!user || petsChecked.current) return;
    petsChecked.current = true;
    getUserPets(user.uid)
      .then((pets) => {
        if (pets.length > 0 && pets[0].id) {
          setRedirectTo(`/pet/${pets[0].id}`);
        }
      })
      .catch((err) => {
        console.error('[Register] getUserPets error:', err);
        // Swallow — fall through to the pet form so the user isn't blocked.
      })
      .finally(() => setPetsLoading(false));
  }, [user]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (petsLoading) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      </Layout>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
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
