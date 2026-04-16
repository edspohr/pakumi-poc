export const REMINDER_TYPE_ICON: Record<string, string> = {
  vaccine: '💉',
  medication: '💊',
  vet_visit: '🏥',
};

export function daysDiff(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export interface UrgencyStyle {
  border: string;
  bg: string;
  text: string;
  label: string;
}

export function urgencyStyle(dateStr: string | null): UrgencyStyle {
  if (!dateStr) {
    return { border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-600', label: 'Sin fecha' };
  }
  const days = daysDiff(dateStr);
  if (days < 0) {
    return { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700', label: 'Vencido' };
  }
  if (days <= 7) {
    return { border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700', label: `En ${days} día${days === 1 ? '' : 's'}` };
  }
  return { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700', label: formatReminderDate(dateStr) };
}

export function formatReminderDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
