import { useState } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';

const AUTH_ERRORS_ES: Record<string, string> = {
  'auth/email-already-in-use': 'Este correo ya está registrado.',
  'auth/invalid-email': 'Correo electrónico inválido.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-not-found': 'No existe una cuenta con este correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Credenciales inválidas.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
  'auth/popup-closed-by-user': 'Ventana cerrada. Intenta de nuevo.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana emergente.',
  'auth/network-request-failed': 'Error de red. Revisa tu conexión.',
};

function getErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  return (code && AUTH_ERRORS_ES[code]) || 'Algo salió mal. Intenta de nuevo.';
}

export function AuthForm() {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const busy = googleLoading || emailLoading;

  async function handleGoogle() {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError(AUTH_ERRORS_ES['auth/invalid-email']);
      return;
    }
    if (password.length < 6) {
      setError(AUTH_ERRORS_ES['auth/weak-password']);
      return;
    }

    setEmailLoading(true);
    try {
      if (mode === 'register') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEmailLoading(false);
    }
  }

  function toggleMode() {
    setMode(mode === 'register' ? 'login' : 'register');
    setError('');
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">
      <button
        onClick={handleGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-3 px-4 font-medium hover:bg-gray-50 transition disabled:opacity-60"
      >
        <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 8 3l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 8 3l5.7-5.7C33.6 6.1 29 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5 0 9.6-1.9 13-5l-6-5.1c-2 1.4-4.5 2.1-7 2.1-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6 5.1C40.9 35.3 44 30 44 24c0-1.3-.1-2.3-.4-3.5z" />
        </svg>
        <span>{googleLoading ? 'Conectando...' : 'Registrarse con Google'}</span>
      </button>

      <div className="flex items-center gap-3">
        <span className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-500 uppercase">o</span>
        <span className="flex-1 h-px bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="tucorreo@ejemplo.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-3 transition disabled:opacity-60"
        >
          {emailLoading
            ? mode === 'register'
              ? 'Creando cuenta...'
              : 'Ingresando...'
            : mode === 'register'
              ? 'Crear cuenta'
              : 'Iniciar sesión'}
        </button>

        <p className="text-sm text-gray-600 text-center">
          {mode === 'register' ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="text-brand hover:text-brand-hover font-medium"
          >
            {mode === 'register' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </p>
      </form>
    </div>
  );
}
