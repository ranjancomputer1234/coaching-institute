import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Batch = {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt?: string;
  _count?: { learners: number };
};

export function BatchesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const list = useQuery({
    queryKey: ['batches'],
    queryFn: () => apiFetch<Batch[]>('/admin/batches'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/batches', {
        method: 'POST',
        body: JSON.stringify({ name, subject: subject || undefined }),
      }),
    onSuccess: () => {
      setName('');
      setSubject('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (b) => `${b.name} ${b.subject ?? ''}`);
    next = filterWhen(next, status, (b, v) => b.status === v);
    next = filterByDateRange(next, dateFrom, dateTo, (b) => b.startDate ?? b.createdAt);
    return next;
  }, [rows, search, status, dateFrom, dateTo]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((b) => b.status)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Batches</h1>
          <p>Cohorts learners are assigned to</p>
        </div>
        {hasPermission('enrollments.create') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              Add batch
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No batches yet"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search name or subject…',
          }}
          dateFrom={{ value: dateFrom, onChange: setDateFrom, label: 'Start from' }}
          dateTo={{ value: dateTo, onChange: setDateTo, label: 'Start to' }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: statusOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setStatus('');
            setDateFrom('');
            setDateTo('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Learners</th>
                <th>Status</th>
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
                filtered.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.name}</td>
                    <td>{batch.subject ?? '—'}</td>
                    <td>{batch._count?.learners ?? 0}</td>
                    <td>
                      <StatusPill value={batch.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Add batch"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="batch-name">Name</label>
            <input
              id="batch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="batch-subject">Subject</label>
            <input
              id="batch-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Add batch
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
