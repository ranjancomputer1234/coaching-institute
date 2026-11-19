import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useMemo, useState } from 'react';
import { apiFetch } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import {
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../shared/lib/tableFilters';
import { usePersistedViewMode } from '../../shared/lib/usePersistedViewMode';
import { ContentDrawer } from '../../shared/ui/ContentDrawer';
import { LayoutViewToggle } from '../../shared/ui/LayoutViewToggle';
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

type DrawerMode = 'create' | 'view' | 'edit';

/** Identifier fields that should be read-only on edit */
const IDENTIFIER_FIELDS = new Set(['key', 'sku', 'code']);

/** Flexible delete/archive endpoint config */
export type DeletePathConfig = {
  method: 'POST' | 'PATCH' | 'DELETE';
  url: (id: string) => string;
  body?: Record<string, unknown>;
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
  updatePath?: (id: string) => string;
  detailPath?: (id: string) => string;
  /** POST to this URL to archive/delete the record */
  archivePath?: (id: string) => string;
  /** Flexible delete config — overrides archivePath when provided */
  deletePath?: DeletePathConfig;
  /** Return true to hide the Delete button for a given row */
  deleteDisabled?: (row: Record<string, unknown>) => boolean;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValues(fields: FieldDef[]) {
  return Object.fromEntries(fields.map((field) => [field.name, '']));
}

function fillFromRow(row: Record<string, unknown>, fields: FieldDef[]) {
  return Object.fromEntries(
    fields.map((field) => {
      const v = row[field.name];
      if (field.type === 'datetime-local' && typeof v === 'string') {
        return [field.name, toLocalInput(v)];
      }
      return [field.name, v != null ? String(v) : ''];
    }),
  );
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
  updatePath,
  detailPath,
  archivePath,
  deletePath,
  deleteDisabled,
}: Props) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>('create');
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields),
  );
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = usePersistedViewMode(`admin.${queryKey}.view`);

  const canCreate = Boolean(createPath) && (!permission || hasPermission(permission));
  const canEdit = Boolean(updatePath) && (!permission || hasPermission(permission));
  const hasActions = canEdit || Boolean(detailPath);

  // Determine whether a delete action is available
  const hasDelete = Boolean(archivePath) || Boolean(deletePath);

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

  const update = useMutation({
    mutationFn: () => {
      const id = String(editingRow!.id);
      const body: Record<string, unknown> = {};
      for (const field of fields) {
        // Skip identifier fields - they cannot change
        if (IDENTIFIER_FIELDS.has(field.name)) continue;
        const raw = values[field.name]?.trim() ?? '';
        if (!raw) continue;
        if (field.type === 'number') body[field.name] = Number(raw);
        else if (field.type === 'datetime-local') body[field.name] = new Date(raw).toISOString();
        else body[field.name] = raw;
      }
      return apiFetch(updatePath!(id), {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setValues(initialValues(fields));
      setEditingRow(null);
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const deleteRecord = useMutation({
    mutationFn: (id: string) => {
      if (deletePath) {
        return apiFetch(deletePath.url(id), {
          method: deletePath.method,
          ...(deletePath.body ? { body: JSON.stringify(deletePath.body) } : {}),
        });
      }
      // Fall back to archivePath (POST)
      return apiFetch(archivePath!(id), { method: 'POST' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
  });

  const openCreate = () => {
    setEditingRow(null);
    setMode('create');
    setValues(initialValues(fields));
    setDrawerOpen(true);
  };

  const openView = (row: Record<string, unknown>) => {
    setEditingRow(row);
    setMode('view');
    setValues(fillFromRow(row, fields));
    setDrawerOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditingRow(row);
    setMode('edit');
    setValues(fillFromRow(row, fields));
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingRow(null);
    setMode('create');
  };

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

  const readOnly = mode === 'view';
  const totalCols = columns.length + ((hasActions || hasDelete) ? 1 : 0);

  const saveError = mode === 'edit' ? update.error : create.error;
  const drawerTitle =
    mode === 'view'
      ? `View ${title}`
      : mode === 'edit'
        ? `Edit ${title}`
        : createLabel;

  // Title for grid/compact: use first column value
  const getRowTitle = (row: Record<string, unknown>) => columns[0]?.value(row) ?? String(row.id ?? '');
  const getRowMeta = (row: Record<string, unknown>) =>
    columns
      .slice(1)
      .map((c) => c.value(row))
      .filter(Boolean)
      .join(' · ');
  const getRowStatus = (row: Record<string, unknown>) =>
    statusKey ? columns.find((c) => c.header === statusKey)?.value(row) : null;

  const handleDelete = (row: Record<string, unknown>) => {
    const label = getRowTitle(row);
    if (window.confirm(`Delete "${label}"? This action cannot be undone.`)) {
      deleteRecord.mutate(String(row.id ?? ''));
    }
  };

  const renderRowActions = (row: Record<string, unknown>) => (
    <>
      {(hasActions || detailPath) && (
        <button type="button" className="btn btn-ghost" onClick={() => openView(row)}>
          View
        </button>
      )}
      {canEdit ? (
        <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
          Edit
        </button>
      ) : null}
      {hasDelete && !(deleteDisabled?.(row)) ? (
        <button
          type="button"
          className="btn btn-danger-ghost"
          disabled={deleteRecord.isPending}
          onClick={() => handleDelete(row)}
        >
          Delete
        </button>
      ) : null}
    </>
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    if (mode === 'edit') update.mutate();
    else create.mutate();
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          {canCreate ? (
            <button type="button" className="btn" onClick={openCreate}>
              {createLabel}
            </button>
          ) : null}
        </PageHeaderActions>
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
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filteredRows.length === 0 ? (
              <p className="muted">No rows match the current filters.</p>
            ) : (
              filteredRows.map((row) => {
                const rowStatus = getRowStatus(row);
                return (
                  <div key={String(row.id)} className="entity-card">
                    <div className="entity-card-cover-empty" />
                    <div className="entity-card-meta">
                      <strong>{getRowTitle(row)}</strong>
                      {rowStatus ? <StatusPill value={rowStatus} /> : null}
                      <span className="muted small">{getRowMeta(row)}</span>
                    </div>
                    <div className="entity-card-actions action-row">
                      {renderRowActions(row)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="panel">
            <ul className="entity-compact-list">
              {filteredRows.length === 0 ? (
                <li className="muted">No rows match the current filters.</li>
              ) : (
                filteredRows.map((row) => {
                  const rowStatus = getRowStatus(row);
                  return (
                    <li key={String(row.id)}>
                      <div className="entity-compact-main">
                        <strong>{getRowTitle(row)}</strong>
                        <span className="muted small">{getRowMeta(row)}</span>
                        {rowStatus ? <StatusPill value={rowStatus} /> : null}
                      </div>
                      <div className="entity-card-actions action-row">
                        {renderRowActions(row)}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.header}>{column.header}</th>
                  ))}
                  {(hasActions || hasDelete) ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={totalCols} className="muted">
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
                      {(hasActions || hasDelete) ? (
                        <td className="action-row">
                          {renderRowActions(row)}
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </PageState>

      <ContentDrawer
        open={drawerOpen && (mode !== 'create' || canCreate)}
        onClose={closeDrawer}
        title={drawerTitle}
        size="full"
      >
        <form className="stack-form" onSubmit={onSubmit}>
          {fields.map((field) => {
            const isIdentifier = IDENTIFIER_FIELDS.has(field.name);
            const fieldReadOnly = readOnly || (mode === 'edit' && isIdentifier);
            return (
              <div className="field" key={field.name}>
                <label htmlFor={`${queryKey}-${field.name}`}>{field.label}</label>
                <input
                  id={`${queryKey}-${field.name}`}
                  type={field.type ?? 'text'}
                  required={field.required && !fieldReadOnly}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ''}
                  readOnly={fieldReadOnly}
                  disabled={fieldReadOnly}
                  onChange={(event) => {
                    if (fieldReadOnly) return;
                    setValues((current) => ({
                      ...current,
                      [field.name]: event.target.value,
                    }));
                  }}
                />
              </div>
            );
          })}
          {saveError instanceof Error ? (
            <p className="error">{saveError.message}</p>
          ) : null}
          {mode === 'view' && canEdit ? (
            <button
              type="button"
              className="btn"
              onClick={() => setMode('edit')}
            >
              Edit record
            </button>
          ) : null}
          {!readOnly ? (
            <button
              className="btn"
              type="submit"
              disabled={mode === 'edit' ? update.isPending : create.isPending}
            >
              {mode === 'edit' ? 'Save changes' : 'Save'}
            </button>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
