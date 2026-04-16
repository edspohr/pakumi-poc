import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Disclaimer } from './Disclaimer';

interface LayoutProps {
  children: React.ReactNode;
  /** Use wider container (max-w-3xl) for dashboard-style pages. */
  wide?: boolean;
  /** Show a footer sign-out button. */
  footerSignOut?: boolean;
}

export function Layout({ children, wide, footerSignOut }: LayoutProps) {
  const { user, signOut } = useAuth();
  const [showPolicy, setShowPolicy] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-brand">
            Pakumi <span aria-hidden="true">🐾</span>
          </Link>
          {user && (
            <button
              onClick={signOut}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </header>
      <main className={`${wide ? 'max-w-3xl' : 'max-w-2xl'} mx-auto px-4 py-10`}>
        {children}
      </main>
      <footer className={`${wide ? 'max-w-3xl' : 'max-w-2xl'} mx-auto px-4 py-8 text-center space-y-2`}>
        {footerSignOut && user && (
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Cerrar sesión
          </button>
        )}
        {user && (
          <button
            onClick={() => setShowPolicy(true)}
            className="block mx-auto text-xs text-gray-400 hover:text-gray-600"
          >
            Política de protección de datos
          </button>
        )}
      </footer>
      {showPolicy && (
        <Disclaimer
          onAccept={async () => {}}
          readOnly
          onClose={() => setShowPolicy(false)}
        />
      )}
    </>
  );
}
