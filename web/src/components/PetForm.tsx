import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ensureUserProfile, registerPet } from '../lib/firestore';
import type { Pet } from '../types';

const COUNTRY_CODES = [
  { code: '+56', flag: '🇨🇱', label: '+56' },
  { code: '+51', flag: '🇵🇪', label: '+51' },
  { code: '+1',  flag: '🇺🇸', label: '+1' },
  { code: '+57', flag: '🇨🇴', label: '+57' },
  { code: '+52', flag: '🇲🇽', label: '+52' },
];

function buildPhone(countryCode: string, local: string): string {
  const digits = local.replace(/\D/g, '');
  if (!digits) return '';
  return `${countryCode}${digits}`;
}

function isValidInternationalPhone(phone: string): boolean {
  return /^\+\d{8,15}$/.test(phone);
}

/** Compute a human-readable Spanish age string from an ISO date. */
export function ageFromBirthDate(iso: string): string {
  const birth = new Date(iso + 'T00:00:00');
  if (isNaN(birth.getTime())) return '';

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) return '';

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
  if (parts.length === 0) return 'Menos de 1 mes';
  return parts.join(' y ');
}

const INPUT_CLS =
  'w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

export function PetForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Pet['species']>('Perro');
  const [breed, setBreed] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weight, setWeight] = useState('');
  const [condition, setCondition] = useState('');
  const [ownerName, setOwnerName] = useState(user?.displayName || '');
  const [countryCode, setCountryCode] = useState('+56');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ageLabel = useMemo(() => ageFromBirthDate(birthDate), [birthDate]);

  // Max date for the date picker = today
  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('Tu sesión expiró. Vuelve a iniciar sesión.');
      return;
    }

    if (!name.trim()) return setError('Ingresa el nombre de tu mascota.');
    if (!ownerName.trim()) return setError('Ingresa tu nombre.');

    const phone = buildPhone(countryCode, phoneLocal);
    if (!isValidInternationalPhone(phone)) {
      return setError(
        'Ingresa un número de WhatsApp válido (8–15 dígitos después del código de país).',
      );
    }

    const weightNum = parseFloat(weight);
    if (!weight.trim() || isNaN(weightNum) || weightNum <= 0) {
      return setError('Ingresa el peso de tu mascota.');
    }

    setLoading(true);
    try {
      // Ensure the user profile doc exists before writing the pet — this is
      // where we'd previously create it on Landing. Keeps the users/{uid}
      // doc alive for RBAC and (later) the disclaimer flag.
      await ensureUserProfile(
        user.uid,
        user.email || '',
        user.displayName || undefined,
      );

      const age = ageFromBirthDate(birthDate);
      const petId = await registerPet({
        userId: user.uid,
        name: name.trim(),
        species,
        breed: breed.trim() || undefined,
        birthDate: birthDate || undefined,
        age: age || undefined,
        weight: weightNum,
        weightUnit: 'kg',
        condition: condition.trim() || undefined,
        ownerName: ownerName.trim(),
        ownerPhone: phone,
      });
      navigate(`/pet/${petId}`);
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar la mascota. Revisa tu conexión e intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4"
      noValidate
    >
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="petName">
          Nombre de la mascota <span className="text-red-500">*</span>
        </label>
        <input
          id="petName"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={INPUT_CLS}
        />
      </div>

      {/* Especie + Raza */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="petSpecies">
            Especie <span className="text-red-500">*</span>
          </label>
          <select
            id="petSpecies"
            required
            value={species}
            onChange={(e) => setSpecies(e.target.value as Pet['species'])}
            className={`${INPUT_CLS} bg-white`}
          >
            <option value="Perro">Perro</option>
            <option value="Gato">Gato</option>
            <option value="Ave">Ave</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="petBreed">
            Raza
          </label>
          <input
            id="petBreed"
            type="text"
            placeholder="Opcional"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      {/* Fecha de nacimiento + Peso */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="petBirthDate">
            Fecha de nacimiento
          </label>
          <input
            id="petBirthDate"
            type="date"
            max={today}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className={INPUT_CLS}
          />
          {ageLabel && (
            <p className="text-xs text-gray-500 mt-1">{ageLabel}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="petWeight">
            Peso <span className="text-red-500">*</span>
          </label>
          <div className="flex">
            <input
              id="petWeight"
              type="number"
              step="0.1"
              min="0"
              required
              placeholder="12"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={`${INPUT_CLS} rounded-r-none`}
            />
            <span className="inline-flex items-center border border-l-0 border-gray-300 rounded-r-lg bg-gray-50 px-3 text-sm text-gray-500">
              kg
            </span>
          </div>
        </div>
      </div>

      {/* Condiciones */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="petCondition">
          Condiciones o alergias conocidas
        </label>
        <textarea
          id="petCondition"
          rows={3}
          placeholder="Ej: alergia al pollo, epilepsia controlada, diabetes..."
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className={INPUT_CLS}
        />
      </div>

      {/* Nombre del dueño */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="ownerName">
          Tu nombre <span className="text-red-500">*</span>
        </label>
        <input
          id="ownerName"
          type="text"
          required
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          className={INPUT_CLS}
        />
      </div>

      {/* WhatsApp */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="ownerPhoneLocal">
          Tu WhatsApp <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <select
            id="ownerPhoneCountry"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.label}
              </option>
            ))}
          </select>
          <input
            id="ownerPhoneLocal"
            type="tel"
            required
            placeholder="912345678"
            value={phoneLocal}
            onChange={(e) => setPhoneLocal(e.target.value)}
            className={`flex-1 ${INPUT_CLS}`}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Selecciona tu país y escribe tu número sin el prefijo.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-3 transition disabled:opacity-60"
      >
        {loading ? 'Guardando...' : 'Registrar mascota'}
      </button>
    </form>
  );
}
