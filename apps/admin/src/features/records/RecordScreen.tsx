import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { apiFetch } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../shared/ui/PageState';

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
  permission?: string;
  fields: FieldDef[];
  columns: Column[];
  statusKey?: string;
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
  permission,
  fields,
  columns,
  statusKey,
}: Props) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields),
  );
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
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const rows = list.data ?? [];

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
      </div>

      {canCreate ? (
        <form className="inline-form panel padded" onSubmit={onSubmit}>
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
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle={`No ${title.toLowerCase()} yet`}
        emptyHint="Create a record or seed the database."
      >
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
              {rows.map((row) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
