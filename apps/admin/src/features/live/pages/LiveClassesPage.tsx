import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
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

type LiveClass = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  provider: string;
  hostName: string | null;
};

export function LiveClassesPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const list = useQuery({
    queryKey: ['live-classes'],
    queryFn: () => apiFetch<LiveClass[]>('/admin/live-classes'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/live-classes', {
        method: 'POST',
        body: JSON.stringify({
          title,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const schedule = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message?: string }>(`/admin/live-classes/${id}/schedule`, {
        method: 'POST',
      }),
    onSuccess: (result) => {
      setNotice(result.message ?? 'Updated');
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (r) => `${r.title} ${r.provider} ${r.hostName ?? ''}`);
    next = filterWhen(next, status, (r, v) => r.status === v);
    next = filterByDateRange(next, dateFrom, dateTo, (r) => r.startsAt);
    return next;
  }, [rows, search, status, dateFrom, dateTo]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.status)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Live classes</h1>
          <p>Schedule classes. A join link is created only when a live provider is configured.</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Schedule class
          </button>
        </PageHeaderActions>
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No live classes"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title or host…',
          }}
          dateFrom={{ value: dateFrom, onChange: setDateFrom, label: 'Starts from' }}
          dateTo={{ value: dateTo, onChange: setDateTo, label: 'Starts to' }}
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
                <th>Title</th>
                <th>Starts</th>
                <th>Provider</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{new Date(row.startsAt).toLocaleString()}</td>
                    <td>{row.provider}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => schedule.mutate(row.id)}
                      >
                        Request room
                      </button>
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
        title="Schedule live class"
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
            <label htmlFor="live-title">Title</label>
            <input
              id="live-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="live-start">Starts</label>
            <input
              id="live-start"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="live-end">Ends</label>
            <input
              id="live-end"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Save draft
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
