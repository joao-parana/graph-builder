// "Atualizado" em Meus grafos (FR-31): hoje, ontem ou a data, na hora local.

const pad = (n: number): string => String(n).padStart(2, '0');

const dayKey = (d: Date): string =>
  `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface UpdatedLabels {
  readonly today: (time: string) => string;
  readonly yesterday: (time: string) => string;
}

export function formatUpdated(iso: string, now: Date, labels: UpdatedLabels): string {
  const date = new Date(iso);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (dayKey(date) === dayKey(now)) return labels.today(time);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return labels.yesterday(time);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear())}`;
}
