import { useState, useMemo } from 'react';
import type { HealthEvent, HealthEventType } from '../types';
import type { Timestamp } from 'firebase/firestore';

const EVENT_META: Record<HealthEventType, { icon: string; label: string }> = {
  symptom: { icon: '🤒', label: 'Síntoma' },
  medication: { icon: '💊', label: 'Medicación' },
  vaccine: { icon: '💉', label: 'Vacuna' },
  vet_visit: { icon: '🏥', label: 'Visita veterinaria' },
  weight: { icon: '⚖️', label: 'Peso' },
  diet_change: { icon: '🍽️', label: 'Cambio de dieta' },
  behavior: { icon: '🐾', label: 'Comportamiento' },
};

const SEVERITY_BADGE: Record<string, { cls: string; label: string }> = {
  low: { cls: 'bg-green-100 text-green-800', label: 'Leve' },
  medium: { cls: 'bg-yellow-100 text-yellow-800', label: 'Moderado' },
  high: { cls: 'bg-red-100 text-red-800', label: 'Alto' },
};

const SOURCE_BADGE: Record<string, { cls: string; label: string }> = {
  whatsapp: { cls: 'bg-emerald-100 text-emerald-700', label: 'WhatsApp' },
  manual: { cls: 'bg-blue-100 text-blue-700', label: 'Manual' },
};

const ALL_TYPES: HealthEventType[] = [
  'symptom', 'medication', 'vaccine', 'vet_visit', 'weight', 'diet_change', 'behavior',
];

function formatDate(event: HealthEvent): string {
  if (event.date) return event.date;
  const ts = event.reportedAt as Timestamp;
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return '—';
}

interface HistoryTimelineProps {
  events: HealthEvent[];
}

export function HistoryTimeline({ events }: HistoryTimelineProps) {
  const [filter, setFilter] = useState<HealthEventType | 'all'>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.type === filter)),
    [events, filter],
  );

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            filter === 'all'
              ? 'bg-brand text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos ({events.length})
        </button>
        {ALL_TYPES.map((t) => {
          const count = events.filter((e) => e.type === t).length;
          if (count === 0) return null;
          const meta = EVENT_META[t];
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === t
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No hay eventos registrados{filter !== 'all' ? ' en esta categoría' : ''}.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((event) => {
            const meta = EVENT_META[event.type] || { icon: '📋', label: event.type };
            const severity = event.severity ? SEVERITY_BADGE[event.severity] : null;
            const source = SOURCE_BADGE[event.source] || SOURCE_BADGE.manual;

            return (
              <div
                key={event.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex gap-3"
              >
                <div className="text-2xl leading-none mt-0.5">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {meta.label}
                    </span>
                    {severity && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${severity.cls}`}
                      >
                        {severity.label}
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${source.cls}`}
                    >
                      {source.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{event.description}</p>
                  {event.notes && (
                    <p className="text-xs text-gray-500 mt-1">{event.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(event)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
