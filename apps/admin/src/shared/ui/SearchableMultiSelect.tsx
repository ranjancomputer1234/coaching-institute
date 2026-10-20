import { useMemo, useState } from 'react';
import { filterBySearch, filterWhen } from '../lib/tableFilters';

export type SelectablePerson = {
  id: string;
  label: string;
  secondary?: string;
  meta?: string;
  filterKey?: string;
};

type SearchableMultiSelectProps = {
  items: SelectablePerson[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  filterLabel?: string;
  filterOptions?: { value: string; label: string }[];
};

export function SearchableMultiSelect({
  items,
  selectedIds,
  onChange,
  loading = false,
  searchPlaceholder = 'Search…',
  emptyLabel = 'No matches',
  filterLabel = 'Filter',
  filterOptions = [],
}: SearchableMultiSelectProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visible = useMemo(() => {
    let next = items;
    next = filterBySearch(
      next,
      query,
      (item) => `${item.label} ${item.secondary ?? ''} ${item.meta ?? ''}`,
    );
    next = filterWhen(next, filter, (item, value) => item.filterKey === value);
    return next;
  }, [items, query, filter]);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectVisible = () => {
    const next = new Set(selectedIds);
    for (const item of visible) next.add(item.id);
    onChange([...next]);
  };

  const clearVisible = () => {
    const drop = new Set(visible.map((i) => i.id));
    onChange(selectedIds.filter((id) => !drop.has(id)));
  };

  return (
    <div className="searchable-multi-select">
      <div className="searchable-multi-select-toolbar">
        <div className="field filter-field-grow">
          <label htmlFor="sms-search">Search students</label>
          <input
            id="sms-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        {filterOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="sms-filter">{filterLabel}</label>
            <select
              id="sms-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All</option>
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="searchable-multi-select-actions">
        <span className="muted">
          {selectedIds.length} selected
          {query || filter ? ` · ${visible.length} shown` : ''}
        </span>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={selectVisible}>
            Select shown
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearVisible}>
            Clear shown
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onChange([])}
            disabled={selectedIds.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="searchable-multi-select-list" role="listbox" aria-multiselectable>
        {loading ? <p className="muted padded">Loading students…</p> : null}
        {!loading && visible.length === 0 ? (
          <p className="muted padded">{emptyLabel}</p>
        ) : null}
        {!loading
          ? visible.map((item) => {
              const checked = selected.has(item.id);
              return (
                <label
                  key={item.id}
                  className={`searchable-multi-select-row${checked ? ' is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="searchable-multi-select-copy">
                    <strong>{item.label}</strong>
                    {item.secondary ? (
                      <span className="muted">{item.secondary}</span>
                    ) : null}
                    {item.meta ? <span className="muted">{item.meta}</span> : null}
                  </span>
                </label>
              );
            })
          : null}
      </div>
    </div>
  );
}
