import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
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

type Batch = {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt?: string;
  _count?: { learners: number; memberships: number };
};

type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  accountState: string;
  batch?: { name: string } | null;
};

type BatchDetail = Batch & {
  memberships?: {
    learner: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
    };
  }[];
};

function learnerLabel(l: {
  firstName: string;
  lastName: string;
  email: string | null;
}) {
  return `${l.firstName} ${l.lastName}`.trim() || l.email || 'Learner';
}

export function BatchesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = usePersistedViewMode('admin.batches.view');

  const list = useQuery({
    queryKey: ['batches'],
    queryFn: () => apiFetch<Batch[]>('/admin/batches'),
  });

  const learners = useQuery({
    queryKey: ['learners', 'batch-picker'],
    queryFn: () => apiFetch<Learner[]>('/admin/learners'),
    enabled: drawerOpen,
  });

  const detail = useQuery({
    queryKey: ['batch', editingId],
    enabled: Boolean(editingId) && drawerOpen,
    queryFn: () => apiFetch<BatchDetail>(`/admin/batches/${editingId}`),
  });

  const selectableLearners: SelectablePerson[] = useMemo(
    () =>
      (learners.data ?? []).map((l) => ({
        id: l.id,
        label: learnerLabel(l),
        secondary: [l.email, l.phone].filter(Boolean).join(' · ') || undefined,
        meta: [l.city, l.batch?.name ? `Batch: ${l.batch.name}` : null]
          .filter(Boolean)
          .join(' · ') || undefined,
        filterKey: l.accountState,
      })),
    [learners.data],
  );

  const stateOptions = useMemo(
    () => distinctOptions((learners.data ?? []).map((l) => l.accountState)),
    [learners.data],
  );

  const resetForm = () => {
    setName('');
    setSubject('');
    setSelectedLearnerIds([]);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (batch: Batch) => {
    setEditingId(batch.id);
    setName(batch.name);
    setSubject(batch.subject ?? '');
    setSelectedLearnerIds([]);
    setDrawerOpen(true);
  };

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          name,
          subject: subject || undefined,
          learnerIds: selectedLearnerIds,
        }),
      }),
    onSuccess: () => {
      resetForm();
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['learners'] });
    },
  });

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/batches/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          subject: subject || undefined,
          learnerIds: selectedLearnerIds,
        }),
      }),
    onSuccess: () => {
      resetForm();
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['batch'] });
    },
  });

  const deleteBatch = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/batches/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['learners'] });
    },
  });

  useEffect(() => {
    if (!editingId || detail.data?.id !== editingId) return;
    setSelectedLearnerIds(
      detail.data.memberships?.map((m) => m.learner.id) ?? [],
    );
  }, [editingId, detail.data]);

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

  const saving = create.isPending || update.isPending;
  const saveError =
    create.error instanceof Error
      ? create.error
      : update.error instanceof Error
        ? update.error
        : null;

  const handleDelete = (batch: Batch) => {
    if (
      window.confirm(
        `Permanently delete batch "${batch.name}"?\n\nThis removes the batch and all its member assignments. This action cannot be undone.`,
      )
    ) {
      deleteBatch.mutate(batch.id);
    }
  };

  const renderActions = (batch: Batch) => (
    <>
      {hasPermission('enrollments.create') ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => openEdit(batch)}
        >
          Edit roster
        </button>
      ) : null}
      <button
        type="button"
        className="btn btn-danger-ghost"
        disabled={deleteBatch.isPending}
        onClick={() => handleDelete(batch)}
      >
        Delete
      </button>
    </>
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Batches</h1>
          <p>Create cohorts and pick specific students for each batch</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          {hasPermission('enrollments.create') ? (
            <button type="button" className="btn" onClick={openCreate}>
              Add batch
            </button>
          ) : null}
        </PageHeaderActions>
      </div>

      {deleteBatch.error instanceof Error ? (
        <p className="error">{deleteBatch.error.message}</p>
      ) : null}

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
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filtered.length === 0 ? (
              <p className="muted">No rows match filters.</p>
            ) : (
              filtered.map((batch) => (
                <div key={batch.id} className="entity-card">
                  <div className="entity-card-cover-empty" />
                  <div className="entity-card-meta">
                    <strong>{batch.name}</strong>
                    <StatusPill value={batch.status} />
                    <span className="muted small">
                      {batch.subject ?? 'No subject'} · {batch._count?.memberships ?? batch._count?.learners ?? 0} students
                    </span>
                  </div>
                  <div className="entity-card-actions action-row">
                    {renderActions(batch)}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="panel">
            <ul className="entity-compact-list">
              {filtered.length === 0 ? (
                <li className="muted">No rows match filters.</li>
              ) : (
                filtered.map((batch) => (
                  <li key={batch.id}>
                    <div className="entity-compact-main">
                      <strong>{batch.name}</strong>
                      <span className="muted small">
                        {batch.subject ?? '—'} · {batch._count?.memberships ?? batch._count?.learners ?? 0} students
                      </span>
                      <StatusPill value={batch.status} />
                    </div>
                    <div className="entity-card-actions action-row">
                      {renderActions(batch)}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Actions</th>
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
                  filtered.map((batch) => (
                    <tr key={batch.id}>
                      <td>{batch.name}</td>
                      <td>{batch.subject ?? '—'}</td>
                      <td>
                        {batch._count?.memberships ?? batch._count?.learners ?? 0}
                      </td>
                      <td>
                        <StatusPill value={batch.status} />
                      </td>
                      <td className="action-row">
                        {renderActions(batch)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </PageState>

      <ContentDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          resetForm();
        }}
        title={editingId ? 'Edit batch roster' : 'Add batch'}
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (editingId) update.mutate();
            else create.mutate();
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

          <div className="field">
            <label>Students in this batch</label>
            <p className="muted" style={{ marginTop: 0 }}>
              Search and filter, then tick the students for this custom batch.
            </p>
            <SearchableMultiSelect
              items={selectableLearners}
              selectedIds={selectedLearnerIds}
              onChange={setSelectedLearnerIds}
              loading={learners.isLoading || (Boolean(editingId) && detail.isLoading)}
              searchPlaceholder="Search name, email, phone, city…"
              emptyLabel="No students match your search"
              filterLabel="Account"
              filterOptions={stateOptions}
            />
          </div>

          {saveError ? <p className="error">{saveError.message}</p> : null}

          <button className="btn" type="submit" disabled={saving || !name.trim()}>
            {editingId ? 'Save batch' : 'Create batch'}
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
