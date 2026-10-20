import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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

export function LiveClassesPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [batchId, setBatchId] = useState('');
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
    // Default: whole batch selected; admin can uncheck for a custom subset.
    setSelectedLearnerIds(batchMemberIdList);
  }, [batchId, batchDetail.data, batchMemberIdList]);

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

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/live-classes', {
        method: 'POST',
        body: JSON.stringify({
          title,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          batchId: batchId || undefined,
          learnerIds: selectedLearnerIds,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setBatchId('');
      setSelectedLearnerIds([]);
      setDrawerOpen(false);
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
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
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
                      <td>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => schedule.mutate(row.id)}
                          disabled={schedule.isPending}
                        >
                          {row.joinUrl ? 'Refresh room' : 'Request room'}
                        </button>
                      </td>
                    </tr>
                  );
                })
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
          <div className="field">
            <label htmlFor="live-batch">Batch (optional)</label>
            <select
              id="live-batch"
              value={batchId}
              onChange={(e) => {
                setBatchId(e.target.value);
                setSelectedLearnerIds([]);
              }}
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
            <p className="muted" style={{ marginBottom: 0 }}>
              If you pick a batch and leave the list empty, everyone in that batch
              is notified when the room is requested.
            </p>
          </div>
          <div className="field">
            <label>Students (optional custom subset)</label>
            <SearchableMultiSelect
              items={selectableLearners}
              selectedIds={selectedLearnerIds}
              onChange={setSelectedLearnerIds}
              loading={learners.isLoading}
              searchPlaceholder="Search name, email, phone…"
              emptyLabel="No students match"
              filterLabel="Account"
              filterOptions={stateOptions}
            />
          </div>
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
          <button className="btn" type="submit" disabled={create.isPending}>
            Save draft
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
