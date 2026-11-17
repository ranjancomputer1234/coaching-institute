import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
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
  category?: string;
  recipientCount?: number;
};

type SendResult = Campaign & { inboxCreated?: number };

const CATEGORIES = ['classes', 'tests', 'news', 'offers', 'system'] as const;

export function NotificationsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canSend = hasPermission('notifications.send_bulk');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('single');
  const [audienceRef, setAudienceRef] = useState('');
  const [category, setCategory] = useState<string>('system');
  const [actionLabel, setActionLabel] = useState('');
  const [targetKind, setTargetKind] = useState('');
  const [targetRef, setTargetRef] = useState('');
  const [sendNote, setSendNote] = useState<string | null>(null);
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
          category,
          actionLabel: actionLabel || undefined,
          targetKind: targetKind || undefined,
          targetRef: targetRef || undefined,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setAudienceRef('');
      setCategory('system');
      setActionLabel('');
      setTargetKind('');
      setTargetRef('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const send = useMutation({
    mutationFn: (id: string) =>
      apiFetch<SendResult>(`/admin/notifications/${id}/send`, { method: 'POST' }),
    onSuccess: (result) => {
      setSendNote(
        typeof result?.recipientCount === 'number'
          ? `Sent to ${result.recipientCount} learner${result.recipientCount === 1 ? '' : 's'} (in-app inbox).`
          : null,
      );
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
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
          <p>Send delivers to each learner's in-app inbox. Push delivery needs a configured provider.</p>
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
                <th>Category</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Provider</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.audience}</td>
                    <td>{row.category ?? 'system'}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>{row.recipientCount ?? 0}</td>
                    <td>{row.providerStatus}</td>
                    <td>
                      {canSend ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => send.mutate(row.id)}
                        >
                          Send
                        </button>
                      ) : (
                        <span className="muted small">Needs send_bulk</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
      {send.error instanceof Error ? <p className="error">{send.error.message}</p> : null}
      {sendNote ? <p className="muted small">{sendNote}</p> : null}

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
          <div className="field">
            <label htmlFor="note-category">Category</label>
            <select
              id="note-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="note-action-label">Action label (optional)</label>
            <input
              id="note-action-label"
              value={actionLabel}
              placeholder="e.g. Join class"
              onChange={(e) => setActionLabel(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="note-target-kind">Target kind (optional)</label>
            <input
              id="note-target-kind"
              value={targetKind}
              placeholder="e.g. course, test, live"
              onChange={(e) => setTargetKind(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="note-target-ref">Target ref (optional)</label>
            <input
              id="note-target-ref"
              value={targetRef}
              placeholder="target id"
              onChange={(e) => setTargetRef(e.target.value)}
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
