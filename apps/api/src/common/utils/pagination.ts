export type PageResult<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};

export function parseCursorTake(cursor?: string, defaultTake = 50, maxTake = 100) {
  const take = Math.min(maxTake, defaultTake);
  return {
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    pageSize: take,
  };
}

export function toPage<T extends { id: string }>(
  rows: T[],
  pageSize: number,
  total: number,
): PageResult<T> {
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    total,
  };
}

export function pricingWhere(
  pricing: string | undefined,
  field: 'commercialMode' | 'pricing' = 'commercialMode',
) {
  if (!pricing) return {};
  const value = pricing.trim().toLowerCase();
  if (value === 'free') {
    return field === 'commercialMode'
      ? { commercialMode: 'free' as const }
      : { pricing: 'free' };
  }
  if (value === 'paid') {
    return field === 'commercialMode'
      ? { commercialMode: { not: 'free' as const } }
      : { pricing: 'paid' };
  }
  return {};
}
