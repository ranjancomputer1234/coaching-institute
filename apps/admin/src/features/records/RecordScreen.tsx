import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';
import { apiFetch } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import {
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../shared/lib/tableFilters';
import { ContentDrawer } from '../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../shared/ui/PageState';
import { TableFilterBar } from '../../shared/ui/TableFilterBar';

export type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'datetime-local';
  required?: boolean;
  placeholder?: string;
};

type Column = {
  header: string;
  value: (row: Record<string, unknown>) => string;
};

type Props = {
  title: string;
  summary: string;
  queryKey: string;
  listPath: string;
  createPath?: string;
  createLabel?: string;
  permission?: string;
  fields: FieldDef[];
  columns: Column[];
  statusKey?: string;
  dateField?: string;
  statusFilterField?: string;
};

function initialValues(fields: FieldDef[]) {
  return Object.fromEntries(fields.map((field) => [field.name, '']));
}

export function RecordScreen({
  title,
  summary,
  queryKey,
  listPath,
  createPath,
  createLabel = 'Add record',
  permission,
  fields,
  columns,
  statusKey,
  dateField,
  statusFilterField,
}: Props) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields),
  );
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const canCreate = Boolean(createPath) && (!permission || hasPermission(permission));

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: () => apiFetch<Record<string, unknown>[]>(listPath),
  });

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      for (const field of fields) {
        const raw = values[field.name]?.trim() ?? '';
        if (!raw) continue;
        if (field.type === 'number') body[field.name] = Number(raw);
        else if (field.type === 'datetime-local') body[field.name] = new Date(raw).toISOString();
        else body[field.name] = raw;
      }
      return apiFetch(createPath!, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setValues(initialValues(fields));
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const rows = list.data ?? [];

  const filteredRows = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (row) =>
      columns.map((c) => c.value(row)).join(' '),
    );
    if (dateField) {
      next = filterByDateRange(next, dateFrom, dateTo, (row) => {
        const v = row[dateField];
        return typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : null;
      });
    }
    if (statusFilterField && statusFilter) {
      next = filterWhen(next, statusFilter, (row, value) =>
        String(row[statusFilterField] ?? '') === value,
      );
    }
    return next;
  }, [
    rows,
    search,
    dateFrom,
    dateTo,
    statusFilter,
    columns,
    dateField,
    statusFilterField,
  ]);

  const statusOptions = useMemo(() => {
    if (!statusFilterField) return [];
    const set = new Set<string>();
    for (const row of rows) {
      const v = row[statusFilterField];
      if (v != null && String(v)) set.add(String(v));
    }
    return [...set].sort().map((v) => ({ value: v, label: v }));
  }, [rows, statusFilterField]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
        {canCreate ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              {createLabel}
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle={`No ${title.toLowerCase()} yet`}
        emptyHint={canCreate ? `Use ${createLabel} to add one.` : 'Seed the database.'}
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search table…',
          }}
          dateFrom={
            dateField
              ? { value: dateFrom, onChange: setDateFrom, label: 'From date' }
              : undefined
          }
          dateTo={
            dateField ? { value: dateTo, onChange: setDateTo, label: 'To date' } : undefined
          }
          selects={
            statusFilterField
              ? [
                  {
                    id: 'status',
                    label: 'Status',
                    value: statusFilter,
                    onChange: setStatusFilter,
                    options: statusOptions,
                  },
                ]
              : undefined
          }
          onReset={() => {
            setSearch('');
            setDateFrom('');
            setDateTo('');
            setStatusFilter('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.header}>{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="muted">
                    No rows match the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={String(row.id)}>
                    {columns.map((column) => (
                      <td key={column.header}>
                        {statusKey && column.header === statusKey ? (
                          <StatusPill value={column.value(row)} />
                        ) : (
                          column.value(row)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawerOpen && canCreate}
        onClose={() => setDrawerOpen(false)}
        title={createLabel}
        size="full"
      >
        <form className="stack-form" onSubmit={onSubmit}>
          {fields.map((field) => (
            <div className="field" key={field.name}>
              <label htmlFor={`${queryKey}-${field.name}`}>{field.label}</label>
              <input
                id={`${queryKey}-${field.name}`}
                type={field.type ?? 'text'}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.name] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <button className="btn" type="submit" disabled={create.isPending}>
            Save
          </button>
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
