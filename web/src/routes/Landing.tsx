import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthForm } from '../components/AuthForm';

export default function Landing() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-brand">
              Pakumi <span aria-hidden="true">🐾</span>
            </span>
          </div>
          <nav>
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/register" className="text-sm font-medium text-brand hover:text-brand-hover">
                  Dashboard
                </Link>
                <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-900">
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <a href="#auth" className="text-sm font-medium text-brand hover:text-brand-hover">
                Iniciar sesión
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center max-w-6xl mx-auto px-4 py-12 md:py-20 gap-12 w-full">
        {/* Left Copy */}
        <div className="flex-1 space-y-6 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
            El guardián digital para tu mejor amigo.
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-xl mx-auto md:mx-0">
            Asistente veterinario con Inteligencia Artificial por WhatsApp y perfil médico de emergencia escaneable por QR.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
              <span className="text-green-500 text-lg leading-none">✓</span> WhatsApp 24/7
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
              <span className="text-green-500 text-lg leading-none">✓</span> Historial Inteligente
            </div>
          </div>
        </div>

        {/* Right Action Area */}
        <div id="auth" className="w-full max-w-md shrink-0">
          {user ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center space-y-4">
              <div className="text-5xl mb-4">👋</div>
              <h3 className="text-xl font-bold text-gray-900">¡Hola de nuevo!</h3>
              <p className="text-gray-600 text-sm">Estás conectado y listo para gestionar el cuidado de tu mascota.</p>
              <button
                onClick={() => navigate('/register')}
                className="w-full bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-3 transition mt-4"
              >
                Ir a mis mascotas
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 text-center">
                <h3 className="text-2xl font-bold text-gray-900">Comienza ahora</h3>
                <p className="text-sm text-gray-500 mt-1">Crea tu cuenta gratis para registrar a tu mascota</p>
              </div>
              <AuthForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
