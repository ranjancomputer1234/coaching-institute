export function filterBySearch<T>(
  rows: T[],
  query: string,
  textFor: (row: T) => string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => textFor(row).toLowerCase().includes(q));
}

export function filterByDateRange<T>(
  rows: T[],
  from: string,
  to: string,
  dateFor: (row: T) => string | Date | null | undefined,
): T[] {
  const start = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const end = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
  if (start === null && end === null) return rows;
  return rows.filter((row) => {
    const raw = dateFor(row);
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    if (start !== null && t < start) return false;
    if (end !== null && t > end) return false;
    return true;
  });
}

export function filterWhen<T>(
  rows: T[],
  value: string,
  match: (row: T, value: string) => boolean,
): T[] {
  if (!value) return rows;
  return rows.filter((row) => match(row, value));
}

export function distinctOptions(
  rows: string[],
): { value: string; label: string }[] {
  return [...new Set(rows.filter(Boolean))].sort().map((v) => ({ value: v, label: v }));
}
