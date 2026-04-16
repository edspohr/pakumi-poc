import { useEffect, useState, useCallback } from 'react';
import { usePetContext } from '../hooks/usePetContext';
import { GroomingList } from '../components/GroomingList';
import { AddGroomingForm } from '../components/AddGroomingForm';
import { getGroomingSessions } from '../lib/firestore';
import type { GroomingSession } from '../types';

export default function Grooming() {
  const { pet, petId } = usePetContext();
  const [sessions, setSessions] = useState<GroomingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadSessions = useCallback(async () => {
    const data = await getGroomingSessions(petId);
    setSessions(data);
  }, [petId]);

  useEffect(() => {
    loadSessions().finally(() => setLoading(false));
  }, [loadSessions]);

  if (loading) {
    return <p className="text-gray-500 text-center py-12">Cargando historial de grooming...</p>;
  }

  const name = pet.name || 'Tu mascota';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">
          Grooming de {name}
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-2 px-4 text-sm transition"
        >
          {showForm ? 'Cerrar formulario' : '+ Registrar sesión'}
        </button>
      </div>

      {showForm && (
        <AddGroomingForm
          petId={petId}
          onSaved={() => {
            loadSessions();
            setShowForm(false);
          }}
        />
      )}

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Sesiones registradas
        </h3>
        <GroomingList sessions={sessions} />
      </section>
    </div>
  );
}
