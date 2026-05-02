import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthForm } from '../components/AuthForm';

export default function Landing() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-platinum">
        <p className="text-gray-500 font-medium italic tracking-widest animate-pulse">Cargando la experiencia Pakumi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-platinum selection:bg-brand/20">
      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 group-hover:rotate-12 transition-transform duration-300">
              <span className="text-white text-xl">🐾</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 tracking-tight">
              Pakumi
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-500 hover:text-brand transition">Características</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-500 hover:text-brand transition">Cómo funciona</a>
            {user ? (
              <Link to="/register" className="bg-brand text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-brand-hover transition shadow-lg shadow-brand/20">
                Dashboard
              </Link>
            ) : (
              <a href="#auth" className="bg-brand text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-brand-hover transition shadow-lg shadow-brand/20">
                Unirme ahora
              </a>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32">
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 text-center lg:text-left space-y-8 z-10 animate-in fade-in slide-in-from-left duration-1000">
            <div className="inline-flex items-center gap-2 bg-brand/10 text-brand px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
              </span>
              Inteligencia Artificial aplicada al cuidado animal
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
              Tu mascota bajo tu <span className="text-gradient">protección digital.</span>
            </h1>
            <p className="text-lg md:text-2xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Un asistente veterinario con IA en tu WhatsApp y un perfil médico de emergencia que habla por tu mascota cuando ella no puede.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center lg:justify-start pt-4">
              {!user ? (
                <a href="#auth" className="w-full sm:w-auto bg-gray-900 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-gray-800 transition shadow-2xl hover:-translate-y-1">
                  Proteger a mi mascota
                </a>
              ) : (
                <button onClick={() => navigate('/register')} className="w-full sm:w-auto bg-gray-900 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-gray-800 transition shadow-2xl hover:-translate-y-1">
                   Ir a mis mascotas
                </button>
              )}
              <div className="flex -space-x-3 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-10 rounded-full ring-4 ring-white bg-gray-100 flex items-center justify-center text-lg border border-gray-100">🐶</div>
                ))}
                <div className="flex items-center ml-4 text-sm font-bold text-gray-500 uppercase tracking-wide">
                  +1,000 familias confían
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative animate-in fade-in zoom-in duration-1000">
            <div className="absolute -inset-4 bg-brand/20 rounded-[4rem] blur-3xl opacity-30 animate-pulse"></div>
            <img 
              src="/assets/hero-dog.png" 
              alt="Mascota con placa QR de Pakumi"
              className="relative w-full rounded-[3rem] shadow-premium border-8 border-white object-cover aspect-4/5 hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-white relative">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-20">
          <div className="space-y-4 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight">Todo lo que necesitas para su bienestar</h2>
            <p className="text-xl text-gray-500 font-medium">Tecnología de vanguardia diseñada para darte tranquilidad absoluta.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-left">
            {[
              { title: "IA Veterinaria 24/7", desc: "Consultas inmediatas sobre salud, nutrición y comportamiento directo en WhatsApp. Sin esperas.", icon: "💬", color: "bg-blue-50" },
              { title: "QR de Emergencia", desc: "Perfil médico público que cualquiera puede escanear para devolverte a tu mascota si se pierde.", icon: "🏷️", color: "bg-green-50" },
              { title: "Historial Inteligente", desc: "Todo el registro de vacunas, desparasitaciones y eventos médicos organizado por nuestra IA.", icon: "📅", color: "bg-purple-50" }
            ].map((f, i) => (
              <div key={i} className="p-10 rounded-[2.5rem] bg-platinum border border-gray-50 hover:border-brand/20 transition-all group shadow-sm hover:shadow-2xl hover:-translate-y-2">
                <div className={`w-16 h-16 ${f.color} rounded-2xl flex items-center justify-center text-4xl mb-8 group-hover:scale-110 transition-transform duration-300`}>{f.icon}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed text-lg">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mockup Section */}
      <section id="how-it-works" className="py-32 bg-brand-dark text-white relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,var(--tw-gradient-stops))] from-brand via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-20 relative">
          <div className="flex-1 space-y-10">
            <h2 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">Tu veterinario de bolsillo, siempre disponible.</h2>
            <div className="space-y-8">
              {[
                { t: "Interactúa", d: "Envía una foto o síntoma por WhatsApp.", i: "📲" },
                { t: "Analiza", d: "Recibe orientación profesional instantánea basada en IA.", i: "🧠" },
                { t: "Actúa", d: "Clasificamos la urgencia y te damos pasos a seguir.", i: "🚀" },
                { t: "Registra", d: "Guardamos cada detalle en su historial clínico.", i: "📝" }
              ].map((item, i) => (
                <div key={i} className="flex gap-6 items-start">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl shrink-0">{item.i}</div>
                  <div>
                    <h4 className="text-xl font-bold mb-1">{item.t}</h4>
                    <p className="text-brand-light/60 text-lg">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 relative group">
             <div className="absolute -inset-10 bg-brand rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
             <img 
              src="/assets/whatsapp-mockup.png" 
              alt="Interfaz de WhatsApp de Pakumi"
              className="relative w-full max-w-sm mx-auto rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-12 border-white/5 hover:scale-105 transition-transform duration-700"
            />
          </div>
        </div>
      </section>

      {/* Auth / CTA Section */}
      <section id="auth" className="py-32 relative bg-platinum">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-6xl mx-auto bg-white rounded-[4rem] shadow-premium overflow-hidden border border-gray-100 flex flex-col lg:flex-row items-stretch">
            <div className="flex-1 p-16 md:p-24 bg-brand-light flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-size-[250%_250%] animate-[shimmer_5s_infinite_linear]"></div>
              <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-8 relative">Únete a la familia Pakumi</h2>
              <p className="text-xl text-gray-600 mb-10 relative">Protege a tu mascota hoy mismo. El registro toma menos de 2 minutos y dura para siempre.</p>
              <div className="space-y-6 relative">
                <div className="flex items-center gap-4 text-brand-dark font-bold text-lg bg-white/50 w-fit px-6 py-3 rounded-2xl border border-white">
                  <span className="text-2xl">✨</span> Acceso gratuito e inmediato
                </div>
                <div className="flex items-center gap-4 text-brand-dark font-bold text-lg bg-white/50 w-fit px-6 py-3 rounded-2xl border border-white">
                  <span className="text-2xl">🛡️</span> Privacidad y seguridad de datos
                </div>
              </div>
            </div>
            <div className="flex-1 p-12 md:p-20 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-gray-100 bg-white">
               {user ? (
                <div className="text-center space-y-8 py-10">
                  <div className="text-8xl animate-bounce">🐕</div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-bold text-gray-900 tracking-tight">¡Hola, {user.displayName || 'bienvenido de nuevo'}!</h3>
                    <p className="text-lg text-gray-500 font-medium">Gestiona tus mascotas y sus perfiles médicos.</p>
                  </div>
                  <button 
                    onClick={() => navigate('/register')}
                    className="w-full bg-brand hover:bg-brand-hover text-white font-black text-xl py-6 rounded-3xl transition shadow-2xl shadow-brand/30 hover:-translate-y-1 active:scale-95"
                  >
                    Ir a mis mascotas
                  </button>
                  <button onClick={signOut} className="text-gray-400 hover:text-gray-600 text-sm font-bold uppercase tracking-widest">Cerrar sesión</button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom duration-700">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-gray-900">Crear cuenta</h3>
                    <p className="text-gray-500">Regístrate en segundos para empezar</p>
                  </div>
                  <AuthForm />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-gray-100 bg-white text-center">
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white text-sm">🐾</div>
              <span className="text-xl font-bold text-gray-900 tracking-tighter">Pakumi</span>
            </div>
            <div className="flex gap-10 text-sm font-bold text-gray-400 uppercase tracking-widest">
              <a href="#" className="hover:text-brand transition">Términos</a>
              <a href="#" className="hover:text-brand transition">Privacidad</a>
              <a href="#" className="hover:text-brand transition">Soporte</a>
            </div>
          </div>
          <div className="h-px bg-gray-50 w-full"></div>
          <p className="text-gray-400 font-medium tracking-tight">© 2026 Pakumi. Innovación y tecnología para el bienestar de tu mejor amigo.</p>
        </div>
      </footer>
    </div>
  );
}
