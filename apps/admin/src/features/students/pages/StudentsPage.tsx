import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { PageState } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  batch?: { name: string } | null;
};

export function StudentsPage() {
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  const list = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch<Student[]>('/students'),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (s) =>
        `${s.firstName} ${s.lastName} ${s.email ?? ''} ${s.phone ?? ''} ${s.batch?.name ?? ''}`,
    );
    next = filterWhen(next, batchFilter, (s, v) => (s.batch?.name ?? '') === v);
    return next;
  }, [rows, search, batchFilter]);

  const batchOptions = useMemo(
    () => distinctOptions(rows.map((s) => s.batch?.name ?? '').filter(Boolean)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p>Manage enrolled coaching students</p>
        </div>
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No students yet"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search name, email, phone, batch…',
          }}
          selects={[
            {
              id: 'batch',
              label: 'Batch',
              value: batchFilter,
              onChange: setBatchFilter,
              options: batchOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setBatchFilter('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((student) => (
                  <tr key={student.id}>
                    <td>
                      {student.firstName} {student.lastName}
                    </td>
                    <td>{student.email ?? '—'}</td>
                    <td>{student.phone ?? '—'}</td>
                    <td>{student.batch?.name ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
