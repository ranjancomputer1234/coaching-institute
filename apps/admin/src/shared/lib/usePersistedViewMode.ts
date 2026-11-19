import { useState } from 'react';

export type CollectionViewMode = 'list' | 'grid' | 'compact';

export function usePersistedViewMode(
  storageKey: string,
  fallback: CollectionViewMode = 'list',
) {
  const [viewMode, setViewModeState] = useState<CollectionViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === 'list' || saved === 'grid' || saved === 'compact') return saved;
    } catch {
      /* ignore */
    }
    return fallback;
  });

  const setViewMode = (mode: CollectionViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      /* ignore */
    }
  };

  return [viewMode, setViewMode] as const;
}
