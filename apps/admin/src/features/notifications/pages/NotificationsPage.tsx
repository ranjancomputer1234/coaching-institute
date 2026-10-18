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

type Campaign = {
  id: string;
  title: string;
  audience: string;
  status: string;
  providerStatus: string;
  failureReason: string | null;
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('single');
  const [audienceRef, setAudienceRef] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<Campaign[]>('/admin/notifications'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          audience,
          audienceRef: audienceRef || undefined,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setAudienceRef('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const send = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/notifications/${id}/send`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (r) => `${r.title} ${r.audience}`);
    next = filterWhen(next, status, (r, v) => r.status === v);
    next = filterWhen(next, audienceFilter, (r, v) => r.audience === v);
    return next;
  }, [rows, search, status, audienceFilter]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.status)),
    [rows],
  );
  const audienceOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.audience)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>Draft campaigns. Send stays unsent until a push provider is configured.</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            New campaign
          </button>
        </PageHeaderActions>
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No campaigns"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title…',
          }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: statusOptions,
            },
            {
              id: 'audience',
              label: 'Audience',
              value: audienceFilter,
              onChange: setAudienceFilter,
              options: audienceOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setStatus('');
            setAudienceFilter('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Audience</th>
                <th>Status</th>
                <th>Provider</th>
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
                    <td>{row.audience}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>{row.providerStatus}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => send.mutate(row.id)}
                      >
                        Send
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
      {send.error instanceof Error ? <p className="error">{send.error.message}</p> : null}

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New notification campaign"
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
            <label htmlFor="note-title">Title</label>
            <input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="note-body">Message</label>
            <input
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="note-audience">Audience</label>
            <select
              id="note-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="single">Single learner</option>
              <option value="segment">Segment</option>
              <option value="all">All learners</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="note-ref">Audience ref</label>
            <input
              id="note-ref"
              value={audienceRef}
              placeholder="learner id or batch id"
              onChange={(e) => setAudienceRef(e.target.value)}
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
