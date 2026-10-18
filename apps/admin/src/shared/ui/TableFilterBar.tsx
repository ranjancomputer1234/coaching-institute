export type FilterSelectConfig = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
};

type TableFilterBarProps = {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    'aria-label'?: string;
  };
  dateFrom?: {
    value: string;
    onChange: (value: string) => void;
    label?: string;
  };
  dateTo?: {
    value: string;
    onChange: (value: string) => void;
    label?: string;
  };
  selects?: FilterSelectConfig[];
  onReset?: () => void;
};

export function TableFilterBar({
  search,
  dateFrom,
  dateTo,
  selects,
  onReset,
}: TableFilterBarProps) {
  const hasFilters =
    search ||
    dateFrom ||
    dateTo ||
    (selects && selects.length > 0);

  if (!hasFilters) return null;

  return (
    <div className="table-filter-bar">
      {search ? (
        <div className="field filter-field-grow">
          <label htmlFor="table-filter-search">Search</label>
          <input
            id="table-filter-search"
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Filter rows…'}
            aria-label={search['aria-label'] ?? 'Filter table'}
          />
        </div>
      ) : null}
      {dateFrom ? (
        <div className="field">
          <label htmlFor="table-filter-from">{dateFrom.label ?? 'From'}</label>
          <input
            id="table-filter-from"
            type="date"
            value={dateFrom.value}
            onChange={(e) => dateFrom.onChange(e.target.value)}
          />
        </div>
      ) : null}
      {dateTo ? (
        <div className="field">
          <label htmlFor="table-filter-to">{dateTo.label ?? 'To'}</label>
          <input
            id="table-filter-to"
            type="date"
            value={dateTo.value}
            onChange={(e) => dateTo.onChange(e.target.value)}
          />
        </div>
      ) : null}
      {selects?.map((sel) => (
        <div className="field" key={sel.id}>
          <label htmlFor={`filter-${sel.id}`}>{sel.label}</label>
          <select
            id={`filter-${sel.id}`}
            value={sel.value}
            onChange={(e) => sel.onChange(e.target.value)}
          >
            <option value="">{sel.allLabel ?? 'All'}</option>
            {sel.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {onReset ? (
        <button type="button" className="btn btn-ghost filter-reset" onClick={onReset}>
          Reset
        </button>
      ) : null}
    </div>
  );
}
