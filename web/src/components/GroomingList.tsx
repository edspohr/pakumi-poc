import { useState } from 'react';
import type { GroomingSession, GroomingType } from '../types';

const TYPE_META: Record<GroomingType, { icon: string; label: string }> = {
  bath: { icon: '🛁', label: 'Baño' },
  haircut: { icon: '✂️', label: 'Corte de pelo' },
  nails: { icon: '💅', label: 'Corte de uñas' },
  dental: { icon: '🦷', label: 'Limpieza dental' },
  other: { icon: '🐾', label: 'Otro' },
};

const SOURCE_BADGE: Record<string, { cls: string; label: string }> = {
  whatsapp: { cls: 'bg-emerald-100 text-emerald-700', label: 'WhatsApp' },
  manual: { cls: 'bg-blue-100 text-blue-700', label: 'Manual' },
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

interface GroomingListProps {
  sessions: GroomingSession[];
}

export function GroomingList({ sessions }: GroomingListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <p className="text-gray-500 text-center py-8">
        No hay sesiones de grooming registradas.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const meta = TYPE_META[s.type] || TYPE_META.other;
        const source = SOURCE_BADGE[s.source] || SOURCE_BADGE.manual;
        const isExpanded = expandedId === s.id;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setExpandedId(isExpanded ? null : (s.id ?? null))}
            className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none mt-0.5">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">
                    {meta.label}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${source.cls}`}
                  >
                    {source.label}
                  </span>
                  {s.cost != null && (
                    <span className="text-xs text-gray-500">
                      S/ {s.cost.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(s.date)}
                  {s.provider && ` — ${s.provider}`}
                </p>
                {!isExpanded && s.notes && (
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {s.notes}
                  </p>
                )}
                {isExpanded && s.notes && (
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                    {s.notes}
                  </p>
                )}
              </div>
              <span className="text-gray-400 text-xs shrink-0 mt-1">
                {isExpanded ? '▲' : '▼'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
