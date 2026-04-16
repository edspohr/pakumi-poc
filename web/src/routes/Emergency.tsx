import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEmergencyProfile } from '../lib/firestore';
import type { EmergencyProfile } from '../types';

function toWhatsAppNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits || null;
}

export default function Emergency() {
  const { petId } = useParams<{ petId: string }>();
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = 'Información de Emergencia — Pakumi';
  }, []);

  useEffect(() => {
    if (!petId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    getEmergencyProfile(petId)
      .then((data) => {
        if (!data) {
          setNotFound(true);
        } else {
          setProfile(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [petId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Cargando información...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Perfil no encontrado</h1>
        <p className="text-gray-600 mb-6">
          No pudimos encontrar la información de esta mascota.
        </p>
        <Link
          to="/"
          className="inline-block bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-2 px-5"
        >
          Ir a Pakumi
        </Link>
      </div>
    );
  }

  const name = profile?.name || 'Mascota';
  const metaParts = [profile?.species, profile?.age].filter(Boolean);
  const condition = (profile?.condition || '').trim();
  const waNumber = toWhatsAppNumber(profile?.ownerPhone || '');
  const greeting = encodeURIComponent(
    `Hola, encontré a ${name} y estoy usando su QR de emergencia de Pakumi.`,
  );

  return (
    <div className="min-h-screen bg-white text-gray-800 antialiased flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <article className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
          <header className="bg-alert-soft border-b-4 border-alert px-6 py-5 text-center">
            <p className="text-alert font-bold uppercase tracking-wide text-sm">
              🆘 Información de Emergencia
            </p>
          </header>

          <div className="px-6 py-6 space-y-5">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900">{name}</h1>
              {metaParts.length > 0 && (
                <p className="text-gray-600 mt-1">{metaParts.join(' · ')}</p>
              )}
            </div>

            {condition && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="text-xs font-semibold text-yellow-900 uppercase tracking-wide mb-1">
                  ⚠️ Condiciones o alergias
                </p>
                <p className="text-yellow-900 text-sm">{condition}</p>
              </div>
            )}

            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Dueño
              </p>
              <p className="text-lg text-gray-900 font-medium">
                {profile?.ownerName || 'No disponible'}
              </p>
            </div>

            <a
              href={waNumber ? `https://wa.me/${waNumber}?text=${greeting}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`block w-full text-center bg-brand hover:bg-brand-hover text-white font-semibold text-lg rounded-xl py-4 transition shadow-md ${
                !waNumber ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              {waNumber ? '📱 Contactar al dueño' : 'Contacto no disponible'}
            </a>
          </div>
        </article>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        Información provista por{' '}
        <span className="font-semibold text-gray-500">Pakumi 🐾</span>
        {' — '}Plataforma de salud para mascotas
      </footer>
    </div>
  );
}
