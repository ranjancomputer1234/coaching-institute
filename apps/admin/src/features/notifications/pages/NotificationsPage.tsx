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
  body?: string | null;
  audienceRef?: string | null;
  actionLabel?: string | null;
  targetKind?: string | null;
  targetRef?: string | null;
};

type SendResult = Campaign & { inboxCreated?: number };

type DrawerMode = 'create' | 'view' | 'edit';

const CATEGORIES = ['classes', 'tests', 'news', 'offers', 'system'] as const;

export function NotificationsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canSend = hasPermission('notifications.send_bulk');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>('create');
  const [editing, setEditing] = useState<Campaign | null>(null);
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

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setBody('');
    setAudience('single');
    setAudienceRef('');
    setCategory('system');
    setActionLabel('');
    setTargetKind('');
    setTargetRef('');
  };

  const fillForm = (row: Campaign) => {
    setEditing(row);
    setTitle(row.title);
    setBody(row.body ?? '');
    setAudience(row.audience);
    setAudienceRef(row.audienceRef ?? '');
    setCategory(row.category ?? 'system');
    setActionLabel(row.actionLabel ?? '');
    setTargetKind(row.targetKind ?? '');
    setTargetRef(row.targetRef ?? '');
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
    setDrawerOpen(true);
  };

  const openView = (row: Campaign) => {
    fillForm(row);
    setMode('view');
    setDrawerOpen(true);
  };

  const openEdit = (row: Campaign) => {
    fillForm(row);
    setMode('edit');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
    setMode('create');
  };

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
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/notifications/${editing!.id}`, {
        method: 'PATCH',
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
      closeDrawer();
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

  const readOnly = mode === 'view';
  const saveError = mode === 'edit' ? update.error : create.error;
  const drawerTitle =
    mode === 'view'
      ? 'View campaign'
      : mode === 'edit'
        ? 'Edit campaign'
        : 'New notification campaign';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>Send delivers to each learner's in-app inbox. Push delivery needs a configured provider.</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={openCreate}>
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
                <th>Actions</th>
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
                    <td className="action-row">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => openView(row)}
                      >
                        View
                      </button>
                      {row.status === 'draft' ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                      ) : null}
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
        onClose={closeDrawer}
        title={drawerTitle}
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (readOnly) return;
            if (mode === 'edit') update.mutate();
            else create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="note-title">Title</label>
            <input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="note-body">Message</label>
            <input
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required={mode === 'create'}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="note-audience">Audience</label>
            <select
              id="note-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={readOnly}
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
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="note-category">Category</label>
            <select
              id="note-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={readOnly}
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
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="note-target-kind">Target kind (optional)</label>
            <input
              id="note-target-kind"
              value={targetKind}
              placeholder="e.g. course, test, live"
              onChange={(e) => setTargetKind(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="note-target-ref">Target ref (optional)</label>
            <input
              id="note-target-ref"
              value={targetRef}
              placeholder="target id"
              onChange={(e) => setTargetRef(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          {saveError instanceof Error ? (
            <p className="error">{saveError.message}</p>
          ) : null}
          {mode === 'view' && editing?.status === 'draft' ? (
            <button type="button" className="btn" onClick={() => setMode('edit')}>
              Edit campaign
            </button>
          ) : null}
          {!readOnly ? (
            <button
              className="btn"
              type="submit"
              disabled={mode === 'edit' ? update.isPending : create.isPending}
            >
              {mode === 'edit' ? 'Save changes' : 'Save draft'}
            </button>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
