import { useEffect, useState, useCallback } from 'react';
import { usePetContext } from '../hooks/usePetContext';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { AddEventForm } from '../components/AddEventForm';
import { HealthChart } from '../components/HealthChart';
import { getHealthEvents } from '../lib/firestore';
import type { HealthEvent } from '../types';

export default function History() {
  const { pet, petId } = usePetContext();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const loadEvents = useCallback(async () => {
    const data = await getHealthEvents(petId);
    setEvents(data);
  }, [petId]);

  useEffect(() => {
    loadEvents().finally(() => setLoading(false));
  }, [loadEvents]);

  if (loading) {
    return <p className="text-gray-500 text-center py-12">Cargando historial clínico...</p>;
  }

  const name = pet.name || 'Tu mascota';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">
          Historial clínico de {name}
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand hover:bg-brand-hover text-white font-medium rounded-lg py-2 px-4 text-sm transition"
        >
          {showForm ? 'Cerrar formulario' : '+ Agregar evento'}
        </button>
      </div>

      {showForm && (
        <AddEventForm
          petId={petId}
          onSaved={() => {
            loadEvents();
            setShowForm(false);
          }}
        />
      )}

      <HealthChart events={events} />

      <section>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Eventos registrados
        </h3>
        <HistoryTimeline events={events} />
      </section>
    </div>
  );
}
