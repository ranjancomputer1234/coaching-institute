import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type SupportCase = {
  id: string;
  subject: string;
  body: string;
  status: string;
  learnerId: string | null;
};

export function SupportPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const list = useQuery({
    queryKey: ['support'],
    queryFn: () => apiFetch<SupportCase[]>('/admin/support-cases'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/support-cases', {
        method: 'POST',
        body: JSON.stringify({ subject, body }),
      }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });

  const close = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/support-cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (r) => `${r.subject} ${r.body}`);
    next = filterWhen(next, status, (r, v) => r.status === v);
    return next;
  }, [rows, search, status]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.status)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Support</h1>
          <p>Cases opened by staff for learner issues</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Open case
          </button>
        </PageHeaderActions>
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No open cases"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search subject…',
          }}
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
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Details</th>
                <th>Status</th>
                <th></th>
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
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.subject}</td>
                    <td>{row.body}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>
                      {row.status !== 'closed' ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => close.mutate(row.id)}
                        >
                          Close
                        </button>
                      ) : null}
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
        title="Open support case"
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
            <label htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="support-body">Details</label>
            <input
              id="support-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Open case
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
