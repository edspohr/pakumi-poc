import { useEffect, useState, useCallback } from 'react';
import { usePetContext } from '../hooks/usePetContext';
import { getPendingReminders, completeReminder } from '../lib/firestore';
import { REMINDER_TYPE_ICON, urgencyStyle, formatReminderDate } from '../lib/reminders';
import type { Reminder } from '../types';

export default function RemindersPage() {
  const { pet, petId } = usePetContext();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(() => {
    getPendingReminders(petId)
      .then(setReminders)
      .catch((err) => console.error('[reminders] fetch error:', err))
      .finally(() => setLoading(false));
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  async function handleComplete(reminderId: string) {
    setCompleting(reminderId);
    try {
      await completeReminder(petId, reminderId);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (err) {
      console.error('[reminders] complete error:', err);
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return <p className="text-gray-500 text-center py-12">Cargando recordatorios...</p>;
  }

  const name = pet.name || 'Tu mascota';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        Recordatorios de {name}
      </h2>

      {reminders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500">
            No hay recordatorios pendientes. Los recordatorios se crean automáticamente cuando hablas con el asistente por WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => {
            const icon = REMINDER_TYPE_ICON[r.type] || '📅';
            const style = urgencyStyle(r.scheduledDate);
            const isCompleting = completing === r.id;

            return (
              <div
                key={r.id}
                className={`border rounded-lg p-4 flex items-start gap-3 ${style.border} ${style.bg}`}
              >
                <span className="text-xl leading-none mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${style.text}`}>
                    {r.description}
                  </p>
                  <p className={`text-xs mt-1 ${style.text} opacity-75`}>
                    {r.scheduledDate ? formatReminderDate(r.scheduledDate) : 'Sin fecha programada'}
                    {' — '}
                    <span className="font-medium">{style.label}</span>
                  </p>
                </div>
                <button
                  onClick={() => r.id && handleComplete(r.id)}
                  disabled={isCompleting}
                  className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {isCompleting ? '...' : 'Completado'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
