import { LayoutGrid, List, Rows3 } from 'lucide-react';
import type { CollectionViewMode } from '../lib/usePersistedViewMode';

type Props = {
  value: CollectionViewMode;
  onChange: (mode: CollectionViewMode) => void;
};

const OPTIONS: { mode: CollectionViewMode; label: string; Icon: typeof List }[] = [
  { mode: 'list', label: 'List', Icon: List },
  { mode: 'grid', label: 'Grid', Icon: LayoutGrid },
  { mode: 'compact', label: 'Compact', Icon: Rows3 },
];

export function LayoutViewToggle({ value, onChange }: Props) {
  return (
    <div className="view-toggle" role="group" aria-label="Layout">
      {OPTIONS.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          className={`view-toggle-btn${value === mode ? ' is-active' : ''}`}
          onClick={() => onChange(mode)}
          title={label}
          aria-pressed={value === mode}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
