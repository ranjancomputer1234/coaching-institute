import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import {
  distinctOptions,
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { usePersistedViewMode } from '../../../shared/lib/usePersistedViewMode';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { LayoutViewToggle } from '../../../shared/ui/LayoutViewToggle';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import {
  SearchableMultiSelect,
  type SelectablePerson,
} from '../../../shared/ui/SearchableMultiSelect';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type LiveClass = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  provider: string;
  hostName: string | null;
  joinUrl?: string | null;
  batchId?: string | null;
  batch?: { id: string; name: string } | null;
  audienceLearnerIdsJson?: string;
};

type Batch = {
  id: string;
  name: string;
  subject: string | null;
  _count?: { memberships?: number; learners?: number };
};

type BatchDetail = Batch & {
  memberships?: { learner: { id: string } }[];
  learners?: { id: string }[];
};

type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  accountState: string;
  batchId?: string | null;
  batch?: { name: string } | null;
};

type DrawerMode = 'create' | 'view' | 'edit';

function parseIds(json?: string) {
  try {
    const parsed = JSON.parse(json || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LiveClassesPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<DrawerMode>('create');
  const [editing, setEditing] = useState<LiveClass | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [batchId, setBatchId] = useState('');
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = usePersistedViewMode('admin.live.view');

  const list = useQuery({
    queryKey: ['live-classes'],
    queryFn: () => apiFetch<LiveClass[]>('/admin/live-classes'),
  });

  const batches = useQuery({
    queryKey: ['batches'],
    queryFn: () => apiFetch<Batch[]>('/admin/batches'),
    enabled: drawerOpen,
  });

  const learners = useQuery({
    queryKey: ['learners', 'live-picker'],
    queryFn: () => apiFetch<Learner[]>('/admin/learners'),
    enabled: drawerOpen,
  });

  const batchDetail = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => apiFetch<BatchDetail>(`/admin/batches/${batchId}`),
    enabled: drawerOpen && Boolean(batchId),
  });

  const batchMemberIdList = useMemo(() => {
    const fromMemberships =
      batchDetail.data?.memberships?.map((m) => m.learner.id) ?? [];
    if (fromMemberships.length) return fromMemberships;
    return (batchDetail.data?.learners ?? []).map((l) => l.id);
  }, [batchDetail.data]);

  const batchMemberIds = useMemo(
    () => new Set(batchMemberIdList),
    [batchMemberIdList],
  );

  useEffect(() => {
    if (!batchId || !batchDetail.data) return;
    // Only auto-fill batch members when creating (not when editing/viewing existing)
    if (mode === 'create') {
      setSelectedLearnerIds(batchMemberIdList);
    }
  }, [batchId, batchDetail.data, batchMemberIdList, mode]);

  const selectableLearners: SelectablePerson[] = useMemo(() => {
    const all = learners.data ?? [];
    const scoped = batchId
      ? all.filter(
          (l) => batchMemberIds.has(l.id) || l.batchId === batchId,
        )
      : all;
    return scoped.map((l) => ({
      id: l.id,
      label: `${l.firstName} ${l.lastName}`.trim() || l.email || 'Learner',
      secondary: [l.email, l.phone].filter(Boolean).join(' · ') || undefined,
      meta: [l.city, l.batch?.name].filter(Boolean).join(' · ') || undefined,
      filterKey: l.accountState,
    }));
  }, [learners.data, batchId, batchMemberIds]);

  const stateOptions = useMemo(
    () => distinctOptions((learners.data ?? []).map((l) => l.accountState)),
    [learners.data],
  );

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setHostName('');
    setStartsAt('');
    setEndsAt('');
    setBatchId('');
    setSelectedLearnerIds([]);
  };

  const fillForm = (row: LiveClass) => {
    setEditing(row);
    setTitle(row.title);
    setHostName(row.hostName ?? '');
    setStartsAt(toLocalInput(row.startsAt));
    setEndsAt(toLocalInput(row.endsAt));
    setBatchId(row.batchId ?? '');
    setSelectedLearnerIds(parseIds(row.audienceLearnerIdsJson));
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
    setDrawerOpen(true);
  };

  const openView = (row: LiveClass) => {
    fillForm(row);
    setMode('view');
    setDrawerOpen(true);
  };

  const openEdit = (row: LiveClass) => {
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
      apiFetch('/admin/live-classes', {
        method: 'POST',
        body: JSON.stringify({
          title,
          hostName: hostName.trim() || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          batchId: batchId || undefined,
          learnerIds: selectedLearnerIds,
        }),
      }),
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/live-classes/${editing!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          hostName: hostName.trim() || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          batchId: batchId || undefined,
          learnerIds: selectedLearnerIds,
        }),
      }),
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const schedule = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message?: string; joinUrl?: string | null }>(
        `/admin/live-classes/${id}/schedule`,
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      setNotice(result.message ?? 'Updated');
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/live-classes/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['live-classes'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (r) =>
        `${r.title} ${r.provider} ${r.hostName ?? ''} ${r.batch?.name ?? ''}`,
    );
    next = filterWhen(next, status, (r, v) => r.status === v);
    next = filterByDateRange(next, dateFrom, dateTo, (r) => r.startsAt);
    return next;
  }, [rows, search, status, dateFrom, dateTo]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.status)),
    [rows],
  );

  const readOnly = mode === 'view';
  const saveError = mode === 'edit' ? update.error : create.error;
  const drawerTitle =
    mode === 'view'
      ? 'View live class'
      : mode === 'edit'
        ? 'Edit live class'
        : 'Schedule live class';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Live classes</h1>
          <p>
            Pick a batch or specific students, then request a Daily room for a
            join link.
          </p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          <button type="button" className="btn" onClick={openCreate}>
            Schedule class
          </button>
        </PageHeaderActions>
      </div>
      {notice ? <p className="muted">{notice}</p> : null}
      {schedule.error instanceof Error ? (
        <p className="error">{schedule.error.message}</p>
      ) : null}
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
            placeholder: 'Search title, host, or batch…',
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
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filtered.length === 0 ? (
              <p className="muted">No rows match filters.</p>
            ) : (
              filtered.map((row) => {
                const customCount = parseIds(row.audienceLearnerIdsJson).length;
                const audience = row.batch?.name ?? (customCount ? `${customCount} students` : '—');
                return (
                  <div key={row.id} className="entity-card">
                    <div className="entity-card-cover-empty" />
                    <div className="entity-card-meta">
                      <strong>{row.title}</strong>
                      <StatusPill value={row.status} />
                      <span className="muted small">{audience} · {new Date(row.startsAt).toLocaleString()}</span>
                    </div>
                    <div className="entity-card-actions action-row">
                      <button className="btn btn-ghost" type="button" onClick={() => openView(row)}>View</button>
                      <button className="btn btn-ghost" type="button" onClick={() => openEdit(row)}>Edit</button>
                      <button className="btn btn-ghost" type="button" onClick={() => schedule.mutate(row.id)} disabled={schedule.isPending}>
                        {row.joinUrl ? 'Refresh room' : 'Request room'}
                      </button>
                      {row.status !== 'cancelled' ? (
                        <button
                          className="btn btn-danger-ghost"
                          type="button"
                          onClick={() => { if (window.confirm(`Cancel "${row.title}"?`)) cancel.mutate(row.id); }}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="panel">
            <ul className="entity-compact-list">
              {filtered.length === 0 ? (
                <li className="muted">No rows match filters.</li>
              ) : (
                filtered.map((row) => {
                  const customCount = parseIds(row.audienceLearnerIdsJson).length;
                  const audience = row.batch?.name ?? (customCount ? `${customCount} students` : '—');
                  return (
                    <li key={row.id}>
                      <div className="entity-compact-main">
                        <strong>{row.title}</strong>
                        <span className="muted small">{audience} · {new Date(row.startsAt).toLocaleString()}</span>
                        <StatusPill value={row.status} />
                      </div>
                      <div className="entity-card-actions action-row">
                        <button className="btn btn-ghost" type="button" onClick={() => openView(row)}>View</button>
                        <button className="btn btn-ghost" type="button" onClick={() => openEdit(row)}>Edit</button>
                        {row.status !== 'cancelled' ? (
                          <button
                            className="btn btn-danger-ghost"
                            type="button"
                            onClick={() => { if (window.confirm(`Cancel "${row.title}"?`)) cancel.mutate(row.id); }}
                          >
                            Cancel
                          </button>
                        ) : null}
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
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Starts</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Join</th>
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
                  filtered.map((row) => {
                    const customCount = parseIds(row.audienceLearnerIdsJson).length;
                    const audience =
                      row.batch?.name ??
                      (customCount ? `${customCount} students` : '—');
                    return (
                      <tr key={row.id}>
                        <td>{row.title}</td>
                        <td>{audience}</td>
                        <td>{new Date(row.startsAt).toLocaleString()}</td>
                        <td>{row.provider}</td>
                        <td>
                          <StatusPill value={row.status} />
                        </td>
                        <td>
                          {row.joinUrl ? (
                            <a href={row.joinUrl} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="action-row">
                          <button className="btn btn-ghost" type="button" onClick={() => openView(row)}>View</button>
                          <button className="btn btn-ghost" type="button" onClick={() => openEdit(row)}>Edit</button>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => schedule.mutate(row.id)}
                            disabled={schedule.isPending}
                          >
                            {row.joinUrl ? 'Refresh room' : 'Request room'}
                          </button>
                          {row.status !== 'cancelled' ? (
                            <button
                              className="btn btn-danger-ghost"
                              type="button"
                              onClick={() => { if (window.confirm(`Cancel "${row.title}"?`)) cancel.mutate(row.id); }}
                            >
                              Cancel
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </PageState>

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
            <label htmlFor="live-title">Title</label>
            <input
              id="live-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="live-host">Instructor</label>
            <input
              id="live-host"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="RACI Faculty"
              readOnly={readOnly}
              disabled={readOnly}
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
              readOnly={readOnly}
              disabled={readOnly}
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
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="live-batch">Batch (optional)</label>
            <select
              id="live-batch"
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                if (mode === 'create') setSelectedLearnerIds([]);
              }}
              disabled={readOnly}
            >
              <option value="">All selected students only / no batch</option>
              {(batches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.subject ? ` · ${b.subject}` : ''}
                  {` · ${b._count?.memberships ?? b._count?.learners ?? 0} students`}
                </option>
              ))}
            </select>
            {!readOnly ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                If you pick a batch and leave the list empty, everyone in that batch
                is notified when the room is requested.
              </p>
            ) : null}
          </div>
          <div className="field">
            <label>Students (optional custom subset)</label>
            <SearchableMultiSelect
              items={selectableLearners}
              selectedIds={selectedLearnerIds}
              onChange={readOnly ? () => {} : setSelectedLearnerIds}
              loading={learners.isLoading}
              searchPlaceholder="Search name, email, phone…"
              emptyLabel="No students match"
              filterLabel="Account"
              filterOptions={stateOptions}
            />
          </div>
          {saveError instanceof Error ? (
            <p className="error">{saveError.message}</p>
          ) : null}
          {mode === 'view' ? (
            <button type="button" className="btn" onClick={() => setMode('edit')}>
              Edit class
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
