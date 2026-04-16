import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { HealthEvent } from '../types';
import type { Timestamp } from 'firebase/firestore';

const SEVERITY_VALUE: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const SEVERITY_LABEL: Record<number, string> = {
  1: 'Leve',
  2: 'Moderado',
  3: 'Alto',
};

function eventDate(event: HealthEvent): string | null {
  if (event.date) return event.date;
  const ts = event.reportedAt as Timestamp;
  if (ts && typeof ts.toDate === 'function') {
    return ts.toDate().toISOString().split('T')[0];
  }
  return null;
}

interface HealthChartProps {
  events: HealthEvent[];
}

export function HealthChart({ events }: HealthChartProps) {
  // Only symptom events with severity are chartable.
  const symptomEvents = useMemo(
    () => events.filter((e) => e.type === 'symptom' && e.severity),
    [events],
  );

  // Unique symptom descriptions for the filter.
  const symptomTypes = useMemo(() => {
    const set = new Set<string>();
    for (const e of symptomEvents) set.add(e.description);
    return Array.from(set).sort();
  }, [symptomEvents]);

  const [selectedSymptom, setSelectedSymptom] = useState<string>('all');

  const chartData = useMemo(() => {
    const filtered =
      selectedSymptom === 'all'
        ? symptomEvents
        : symptomEvents.filter((e) => e.description === selectedSymptom);

    const byDate = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const d = eventDate(e);
      if (!d || !e.severity) continue;
      const val = SEVERITY_VALUE[e.severity];
      const existing = byDate.get(d);
      if (existing) {
        existing.total += val;
        existing.count++;
      } else {
        byDate.set(d, { total: val, count: 1 });
      }
    }

    return Array.from(byDate.entries())
      .map(([date, { total, count }]) => ({
        date,
        severidad: Math.round((total / count) * 10) / 10,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [symptomEvents, selectedSymptom]);

  if (symptomEvents.length < 2) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
        <p className="text-gray-500 text-sm">
          Se necesitan al menos 2 registros de síntomas con severidad para generar el gráfico.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-base font-bold text-gray-900">
          Evolución de síntomas
        </h3>
        {symptomTypes.length > 1 && (
          <select
            value={selectedSymptom}
            onChange={(e) => setSelectedSymptom(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="all">Todos los síntomas</option>
            {symptomTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {chartData.length < 2 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No hay suficientes datos para este filtro.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(d: string) => {
                const [, m, day] = d.split('-');
                return `${day}/${m}`;
              }}
            />
            <YAxis
              domain={[0, 3.5]}
              ticks={[1, 2, 3]}
              tickFormatter={(v: number) => SEVERITY_LABEL[v] || ''}
              tick={{ fontSize: 11 }}
              width={70}
            />
            <Tooltip
              formatter={(v: unknown) => [SEVERITY_LABEL[Math.round(Number(v))] || String(v), 'Severidad'] as [string, string]}
              labelFormatter={(d: unknown) => `Fecha: ${String(d)}`}
            />
            <Line
              type="monotone"
              dataKey="severidad"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4, fill: '#22c55e' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
