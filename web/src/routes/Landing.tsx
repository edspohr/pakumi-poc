import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDisclaimer } from '../hooks/useDisclaimer';
import { ensureUserProfile, getUserPets } from '../lib/firestore';
import { Layout } from '../components/Layout';
import { AuthForm } from '../components/AuthForm';
import { Disclaimer } from '../components/Disclaimer';

export default function Landing() {
  const { user, loading } = useAuth();
  const { accepted, loading: disclaimerLoading, accept } = useDisclaimer(user?.uid);
  const profileEnsured = useRef(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [checkingPets, setCheckingPets] = useState(false);

  // Create user profile doc on first auth (auto-assigns role: 'owner').
  useEffect(() => {
    if (!user || profileEnsured.current) return;
    profileEnsured.current = true;
    ensureUserProfile(user.uid, user.email || '', user.displayName || undefined).catch(
      (err) => console.error('[Landing] ensureUserProfile error:', err),
    );
  }, [user]);

  // After disclaimer accepted, check if user has pets → redirect to first pet or register.
  useEffect(() => {
    if (!user || !accepted || checkingPets || redirectTo) return;
    setCheckingPets(true);
    getUserPets(user.uid)
      .then((pets) => {
        if (pets.length > 0 && pets[0].id) {
          setRedirectTo(`/pet/${pets[0].id}`);
        } else {
          setRedirectTo('/register');
        }
      })
      .catch(() => setRedirectTo('/register'));
  }, [user, accepted, checkingPets, redirectTo]);

  if (loading || (user && disclaimerLoading)) {
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      </Layout>
    );
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (user && accepted) {
    // Still checking pets
    return (
      <Layout>
        <div className="text-center text-gray-500 py-12">Cargando...</div>
      </Layout>
    );
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
      {user && !accepted && <Disclaimer onAccept={accept} />}
    </Layout>
  );
}
