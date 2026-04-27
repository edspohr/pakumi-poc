import { useEffect, useState } from 'react';
import { Outlet, NavLink, Navigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getPet } from '../lib/firestore';
import { PetSelector } from './PetSelector';
import { Disclaimer } from './Disclaimer';
import type { Pet } from '../types';

const NAV_ITEMS = [
  { to: '', icon: '📋', label: 'Resumen', end: true },
  { to: 'history', icon: '📊', label: 'Historial' },
  { to: 'grooming', icon: '✂️', label: 'Grooming' },
  { to: 'reminders', icon: '📅', label: 'Recordatorios' },
  { to: 'settings', icon: '⚙️', label: 'Configuración' },
];

function navLinkCls({ isActive }: { isActive: boolean }): string {
  const base = 'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition';
  return isActive
    ? `${base} bg-brand/10 text-brand`
    : `${base} text-gray-600 hover:bg-gray-100 hover:text-gray-900`;
}

function bottomNavCls({ isActive }: { isActive: boolean }): string {
  const base = 'flex flex-col items-center gap-0.5 flex-1 py-2 text-xs font-medium transition';
  return isActive
    ? `${base} text-brand`
    : `${base} text-gray-400`;
}

export default function DashboardLayout() {
  const { petId } = useParams<{ petId: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !petId) {
      setLoading(false);
      return;
    }

    getPet(petId)
      .then((data) => {
        if (!data) {
          setError('No encontramos esta mascota.');
        } else if (data.userId !== user.uid) {
          setError('No tienes permiso para ver esta mascota.');
        } else {
          setPet(data);
        }
      })
      .catch((err) => {
        console.error('[DashboardLayout] fetch error:', err);
        setError('No se pudo cargar la información.');
      })
      .finally(() => setLoading(false));
  }, [petId, user, authLoading]);

  // Auth guards
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando información de tu mascota...</p>
      </div>
    );
  }

  if (error || !pet) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6 text-center max-w-md">
          <p className="text-red-600 mb-4">{error || 'Mascota no encontrada.'}</p>
          <Link
            to="/"
            className="inline-block bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-2 px-4"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand shrink-0">
            Pakumi <span aria-hidden="true">🐾</span>
          </Link>
          <div className="hidden sm:block mx-4 flex-1 max-w-48">
            <PetSelector currentPetId={petId!} />
          </div>
          <button
            onClick={signOut}
            className="text-sm text-gray-600 hover:text-gray-900 shrink-0"
          >
            Cerrar sesión
          </button>
        </div>
        {/* Mobile pet selector */}
        <div className="sm:hidden border-t border-gray-100 px-4 py-1">
          <PetSelector currentPetId={petId!} />
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-gray-200 bg-white py-6 px-3">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={navLinkCls}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto pt-6 space-y-2 px-3">
            <button
              onClick={() => setShowPolicy(true)}
              className="block text-xs text-gray-400 hover:text-gray-600"
            >
              Política de datos
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-6 md:px-8 pb-24 md:pb-6">
          <Outlet context={{ pet, petId }} />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30">
        <div className="flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={bottomNavCls}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {showPolicy && (
        <Disclaimer
          onAccept={async () => {}}
          readOnly
          onClose={() => setShowPolicy(false)}
        />
      )}
    </div>
  );
}
