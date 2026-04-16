import { useState } from 'react';
import { addHealthEvent } from '../lib/firestore';
import type { HealthEventType, Severity } from '../types';

const EVENT_OPTIONS: { value: HealthEventType; label: string }[] = [
  { value: 'symptom', label: '🤒 Síntoma' },
  { value: 'medication', label: '💊 Medicación' },
  { value: 'vaccine', label: '💉 Vacuna' },
  { value: 'vet_visit', label: '🏥 Visita veterinaria' },
  { value: 'weight', label: '⚖️ Peso' },
  { value: 'diet_change', label: '🍽️ Cambio de dieta' },
  { value: 'behavior', label: '🐾 Comportamiento' },
];

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'low', label: 'Leve' },
  { value: 'medium', label: 'Moderado' },
  { value: 'high', label: 'Alto' },
];

const INPUT_CLS =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand';

interface AddEventFormProps {
  petId: string;
  onSaved: () => void;
}

export function AddEventForm({ petId, onSaved }: AddEventFormProps) {
  const [type, setType] = useState<HealthEventType>('symptom');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!description.trim()) {
      setError('Ingresa una descripción del evento.');
      return;
    }

    setLoading(true);
    try {
      await addHealthEvent(petId, {
        type,
        description: description.trim(),
        severity: severity || null,
        date: date || null,
        source: 'manual',
        notes: notes.trim() || undefined,
      });
      // Reset form
      setDescription('');
      setDate('');
      setSeverity('');
      setNotes('');
      onSaved();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el evento. Intenta de nuevo.');
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
      <h3 className="text-base font-bold text-gray-900">Agregar evento</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="evtType">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            id="evtType"
            value={type}
            onChange={(e) => setType(e.target.value as HealthEventType)}
            className={`${INPUT_CLS} bg-white`}
          >
            {EVENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="evtSeverity">
            Severidad
          </label>
          <select
            id="evtSeverity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | '')}
            className={`${INPUT_CLS} bg-white`}
          >
            <option value="">Sin especificar</option>
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="evtDesc">
          Descripción <span className="text-red-500">*</span>
        </label>
        <input
          id="evtDesc"
          type="text"
          required
          placeholder="Ej: Vómitos después de comer"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={INPUT_CLS}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="evtDate">
            Fecha
          </label>
          <input
            id="evtDate"
            type="date"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="evtNotes">
          Notas adicionales
        </label>
        <textarea
          id="evtNotes"
          rows={2}
          placeholder="Observaciones, contexto, etc."
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
        {loading ? 'Guardando...' : 'Agregar evento'}
      </button>
    </form>
  );
}
