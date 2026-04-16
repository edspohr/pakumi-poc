import { useState } from 'react';
import { addGroomingSession } from '../lib/firestore';
import { useAuth } from '../hooks/useAuth';
import type { GroomingType } from '../types';

const TYPE_OPTIONS: { value: GroomingType; label: string }[] = [
  { value: 'bath', label: '🛁 Baño' },
  { value: 'haircut', label: '✂️ Corte de pelo' },
  { value: 'nails', label: '💅 Corte de uñas' },
  { value: 'dental', label: '🦷 Limpieza dental' },
  { value: 'other', label: '🐾 Otro' },
];

const INPUT_CLS =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

interface AddGroomingFormProps {
  petId: string;
  onSaved: () => void;
}

export function AddGroomingForm({ petId, onSaved }: AddGroomingFormProps) {
  const { user } = useAuth();
  const [type, setType] = useState<GroomingType>('bath');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [provider, setProvider] = useState('');
  const [cost, setCost] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!date) {
      setError('Selecciona la fecha de la sesión.');
      return;
    }
    if (!user) {
      setError('Tu sesión expiró.');
      return;
    }

    setLoading(true);
    try {
      const costNum = parseFloat(cost);
      await addGroomingSession(petId, {
        petId,
        userId: user.uid,
        date,
        type,
        notes: notes.trim(),
        provider: provider.trim() || undefined,
        cost: isNaN(costNum) || costNum <= 0 ? undefined : costNum,
        source: 'manual',
      });
      setDate('');
      setNotes('');
      setProvider('');
      setCost('');
      onSaved();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar la sesión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4"
      noValidate
    >
      <h3 className="text-base font-bold text-gray-900">Registrar sesión de grooming</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="groomType">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            id="groomType"
            value={type}
            onChange={(e) => setType(e.target.value as GroomingType)}
            className={`${INPUT_CLS} bg-white`}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="groomDate">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            id="groomDate"
            type="date"
            max={today}
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="groomProvider">
            Peluquería / Proveedor
          </label>
          <input
            id="groomProvider"
            type="text"
            placeholder="Nombre del salón o peluquero"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="groomCost">
            Costo (S/)
          </label>
          <input
            id="groomCost"
            type="number"
            step="0.01"
            min="0"
            placeholder="50.00"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="groomNotes">
          Notas
        </label>
        <textarea
          id="groomNotes"
          rows={2}
          placeholder="Detalles de la sesión, productos usados, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={INPUT_CLS}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-60"
      >
        {loading ? 'Guardando...' : 'Registrar sesión'}
      </button>
    </form>
  );
}
