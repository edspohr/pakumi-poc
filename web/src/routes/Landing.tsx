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
  const redirectChecked = useRef(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Create user profile doc on first auth (auto-assigns role: 'owner').
  useEffect(() => {
    if (!user || profileEnsured.current) return;
    profileEnsured.current = true;
    ensureUserProfile(user.uid, user.email || '', user.displayName || undefined).catch(
      (err) => console.error('[Landing] ensureUserProfile error:', err),
    );
  }, [user]);

  // After disclaimer accepted, check pets once and pick a redirect target.
  // Using a ref (not state) so this latches exactly once per mount and does
  // not cause an intermediate re-render that could re-trigger the effect.
  useEffect(() => {
    if (!user || !accepted || redirectChecked.current) return;
    redirectChecked.current = true;
    getUserPets(user.uid)
      .then((pets) => {
        if (pets.length > 0 && pets[0].id) {
          setRedirectTo(`/pet/${pets[0].id}`);
        } else {
          setRedirectTo('/register');
        }
      })
      .catch((err) => {
        console.error('[Landing] getUserPets error:', err);
        setRedirectTo('/register');
      });
  }, [user, accepted]);

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
    // Pet lookup is in flight — effect fires, redirectTo will be set shortly.
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
