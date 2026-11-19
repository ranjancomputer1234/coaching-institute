import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { usePersistedViewMode } from '../../../shared/lib/usePersistedViewMode';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { LayoutViewToggle } from '../../../shared/ui/LayoutViewToggle';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  accountState: string;
  createdAt?: string;
  lastActiveAt?: string | null;
  batch?: { name: string } | null;
  enrollments?: { course: { title: string }; status: string }[];
};

type LearnerActivity = {
  summary: {
    lastActiveAt: string | null;
    memberSince: string;
    enrolledCourses: number;
    lessonsCompleted: number;
    lessonsInProgress: number;
    testAttempts: number;
    documentsIssued: number;
    resourceDownloads: number;
  };
  items: {
    id: string;
    kind: string;
    title: string;
    detail?: string;
    occurredAt: string;
  }[];
};

// ViewMode is provided by usePersistedViewMode (CollectionViewMode)

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function initials(firstName: string, lastName: string) {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function fullName(learner: Pick<Learner, 'firstName' | 'lastName'>) {
  return `${learner.firstName} ${learner.lastName}`.trim() || 'Learner';
}

function kindLabel(kind: string) {
  switch (kind) {
    case 'lesson_complete':
      return 'Lesson';
    case 'lesson_progress':
      return 'Progress';
    case 'test':
      return 'Test';
    case 'enrollment':
      return 'Course';
    case 'entitlement':
      return 'Access';
    case 'document':
      return 'Document';
    case 'download':
      return 'Download';
    case 'admin':
      return 'Admin';
    case 'session':
      return 'App';
    case 'account':
      return 'Account';
    default:
      return kind;
  }
}

export function LearnersPage() {
  const [q, setQ] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedViewMode('admin.learners.view');
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');

  const canEditProfile = hasPermission('users.update');
  const canSuspend = hasPermission('users.suspend');

  const list = useQuery({
    queryKey: ['learners', q],
    queryFn: () =>
      apiFetch<Learner[]>(
        `/admin/learners${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const detail = useQuery({
    queryKey: ['learner', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiFetch<Learner>(`/admin/learners/${selectedId}`),
  });

  const activity = useQuery({
    queryKey: ['learner-activity', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiFetch<LearnerActivity>(`/admin/learners/${selectedId}/activity`),
  });

  const suspend = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/learners/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Suspended from admin panel' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['learner', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['learner-activity', selectedId] });
    },
  });

  const reactivate = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/learners/${id}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Reactivated from admin panel' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['learner', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['learner-activity', selectedId] });
    },
  });

  const updateLearner = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/learners/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: editFirstName.trim() || undefined,
          lastName: editLastName.trim() || undefined,
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          city: editCity.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['learner', selectedId] });
    },
  });

  // setViewMode from usePersistedViewMode handles localStorage automatically

  const openLearner = (id: string, startEdit = false) => {
    setSelectedId(id);
    setEditMode(false);
    if (startEdit) {
      // Prefill after detail loads via effect below when opening edit immediately
      const row = (list.data ?? []).find((l) => l.id === id);
      if (row) {
        setEditFirstName(row.firstName);
        setEditLastName(row.lastName);
        setEditEmail(row.email ?? '');
        setEditPhone(row.phone ?? '');
        setEditCity(row.city ?? '');
        setEditMode(true);
      }
    }
  };

  const closeDrawer = () => {
    setSelectedId(null);
    setEditMode(false);
  };

  const enterEdit = () => {
    if (!detail.data) return;
    setEditFirstName(detail.data.firstName);
    setEditLastName(detail.data.lastName);
    setEditEmail(detail.data.email ?? '');
    setEditPhone(detail.data.phone ?? '');
    setEditCity(detail.data.city ?? '');
    setEditMode(true);
  };

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const filteredRows = useMemo(() => {
    let next = rows;
    next = filterWhen(next, stateFilter, (l, v) => l.accountState === v);
    next = filterWhen(next, batchFilter, (l, v) => (l.batch?.name ?? '') === v);
    return next;
  }, [rows, stateFilter, batchFilter]);

  const stateOptions = useMemo(
    () => distinctOptions(rows.map((l) => l.accountState)),
    [rows],
  );
  const batchOptions = useMemo(
    () => distinctOptions(rows.map((l) => l.batch?.name ?? '')),
    [rows],
  );

  const stats = useMemo(() => {
    const active = rows.filter((l) => l.accountState === 'active').length;
    const suspended = rows.filter((l) => l.accountState === 'suspended').length;
    const withBatch = rows.filter((l) => Boolean(l.batch?.name)).length;
    return {
      total: rows.length,
      active,
      suspended,
      withBatch,
      showing: filteredRows.length,
    };
  }, [rows, filteredRows.length]);

  const summary = activity.data?.summary;

  const renderActions = (learner: Learner, stopPropagation = false) => (
    <div
      className="action-row learner-card-actions"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => openLearner(learner.id)}
      >
        View
      </button>
      {canEditProfile ? (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => openLearner(learner.id, true)}
        >
          Edit
        </button>
      ) : null}
    </div>
  );

  return (
    <section className="learners-page">
      <div className="page-header">
        <div>
          <h1>Learners</h1>
          <p>Search accounts, switch layouts, and open a profile to view or edit</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
        </PageHeaderActions>
      </div>

      <div className="learners-stats">
        <div className="learners-stat">
          <strong>{stats.total}</strong>
          <span>Total</span>
        </div>
        <div className="learners-stat">
          <strong>{stats.active}</strong>
          <span>Active</span>
        </div>
        <div className="learners-stat">
          <strong>{stats.suspended}</strong>
          <span>Suspended</span>
        </div>
        <div className="learners-stat">
          <strong>{stats.withBatch}</strong>
          <span>In a batch</span>
        </div>
        <div className="learners-stat learners-stat-muted">
          <strong>{stats.showing}</strong>
          <span>Showing</span>
        </div>
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No learners found"
        emptyHint="Try another search or seed the database."
      >
        <TableFilterBar
          search={{
            value: q,
            onChange: setQ,
            placeholder: 'Search name, email, phone, ID…',
            'aria-label': 'Search learners',
          }}
          selects={[
            {
              id: 'state',
              label: 'State',
              value: stateFilter,
              onChange: setStateFilter,
              options: stateOptions,
            },
            {
              id: 'batch',
              label: 'Batch',
              value: batchFilter,
              onChange: setBatchFilter,
              options: batchOptions,
            },
          ]}
          onReset={() => {
            setQ('');
            setStateFilter('');
            setBatchFilter('');
          }}
        />

        {filteredRows.length === 0 ? (
          <div className="panel padded">
            <p className="muted">No rows match filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="learner-grid">
            {filteredRows.map((learner) => (
              <article
                key={learner.id}
                className={`learner-card${selectedId === learner.id ? ' is-selected' : ''}`}
                onClick={() => openLearner(learner.id)}
              >
                <div className="learner-card-top">
                  <div className="learner-avatar" aria-hidden>
                    {initials(learner.firstName, learner.lastName)}
                  </div>
                  <StatusPill value={learner.accountState} />
                </div>
                <h3>{fullName(learner)}</h3>
                <p className="muted small">{learner.email ?? 'No email'}</p>
                <p className="muted small">{learner.phone ?? 'No phone'}</p>
                <div className="learner-card-meta">
                  <span>{learner.batch?.name ?? 'No batch'}</span>
                  <span>{learner.city ?? '—'}</span>
                </div>
                {renderActions(learner, true)}
              </article>
            ))}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="panel learner-compact-panel">
            <ul className="learner-compact-list">
              {filteredRows.map((learner) => (
                <li
                  key={learner.id}
                  className={selectedId === learner.id ? 'is-selected' : ''}
                >
                  <button
                    type="button"
                    className="learner-compact-main"
                    onClick={() => openLearner(learner.id)}
                  >
                    <span className="learner-avatar learner-avatar-sm" aria-hidden>
                      {initials(learner.firstName, learner.lastName)}
                    </span>
                    <span className="learner-compact-text">
                      <strong>{fullName(learner)}</strong>
                      <span className="muted small">
                        {[learner.email, learner.phone, learner.batch?.name]
                          .filter(Boolean)
                          .join(' · ') || 'No contact'}
                      </span>
                    </span>
                    <StatusPill value={learner.accountState} />
                  </button>
                  {renderActions(learner)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="panel">
            <table className="learner-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>State</th>
                  <th>Batch</th>
                  <th>City</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((learner) => (
                  <tr
                    key={learner.id}
                    className={selectedId === learner.id ? 'row-selected' : ''}
                  >
                    <td>
                      <div className="learner-name-cell">
                        <span className="learner-avatar learner-avatar-sm" aria-hidden>
                          {initials(learner.firstName, learner.lastName)}
                        </span>
                        <button
                          type="button"
                          className="learner-name-link"
                          onClick={() => openLearner(learner.id)}
                        >
                          {fullName(learner)}
                        </button>
                      </div>
                    </td>
                    <td>
                      {learner.email ?? '—'}
                      <br />
                      <span className="muted">{learner.phone ?? '—'}</span>
                    </td>
                    <td>
                      <StatusPill value={learner.accountState} />
                    </td>
                    <td>{learner.batch?.name ?? '—'}</td>
                    <td>{learner.city ?? '—'}</td>
                    <td>{renderActions(learner)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageState>

      <ContentDrawer
        open={Boolean(selectedId)}
        onClose={closeDrawer}
        title={
          detail.data
            ? editMode
              ? `Edit · ${fullName(detail.data)}`
              : fullName(detail.data)
            : 'Learner profile'
        }
        size="panel"
      >
        {!selectedId ? null : detail.isLoading ? (
          <p className="muted">Loading…</p>
        ) : detail.data ? (
          <div className="learner-drawer">
            <div className="learner-drawer-hero">
              <div className="learner-avatar learner-avatar-lg" aria-hidden>
                {initials(detail.data.firstName, detail.data.lastName)}
              </div>
              <div>
                <p className="learner-drawer-name">
                  {fullName(detail.data)}
                </p>
                <StatusPill value={detail.data.accountState} />
                <p className="muted small">{detail.data.id}</p>
              </div>
            </div>

            {editMode ? (
              <form
                className="stack-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateLearner.mutate();
                }}
              >
                <div className="field">
                  <label htmlFor="edit-firstName">First name</label>
                  <input
                    id="edit-firstName"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-lastName">Last name</label>
                  <input
                    id="edit-lastName"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-email">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-phone">Phone</label>
                  <input
                    id="edit-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="edit-city">City</label>
                  <input
                    id="edit-city"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                  />
                </div>
                {updateLearner.error instanceof Error ? (
                  <p className="error">{updateLearner.error.message}</p>
                ) : null}
                <div className="action-row">
                  <button type="submit" className="btn" disabled={updateLearner.isPending}>
                    Save changes
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <dl className="drawer-dl learner-profile-dl">
                  <dt>Email</dt>
                  <dd>{detail.data.email ?? '—'}</dd>
                  <dt>Phone</dt>
                  <dd>{detail.data.phone ?? '—'}</dd>
                  <dt>City</dt>
                  <dd>{detail.data.city ?? '—'}</dd>
                  <dt>Batch</dt>
                  <dd>{detail.data.batch?.name ?? '—'}</dd>
                </dl>

                <div className="action-row">
                  {canEditProfile ? (
                    <button type="button" className="btn" onClick={enterEdit}>
                      Edit profile
                    </button>
                  ) : null}
                  {canSuspend ? (
                    detail.data.accountState === 'suspended' ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => reactivate.mutate(detail.data.id)}
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          if (
                            confirm(
                              'Suspend this learner? Active sessions should be revoked.',
                            )
                          ) {
                            suspend.mutate(detail.data.id);
                          }
                        }}
                      >
                        Suspend
                      </button>
                    )
                  ) : null}
                </div>
              </>
            )}

            {!editMode && summary ? (
              <div className="activity-summary">
                <div className="activity-stat">
                  <strong>{summary.enrolledCourses}</strong>
                  <span>Courses</span>
                </div>
                <div className="activity-stat">
                  <strong>{summary.lessonsCompleted}</strong>
                  <span>Lessons</span>
                </div>
                <div className="activity-stat">
                  <strong>{summary.testAttempts}</strong>
                  <span>Tests</span>
                </div>
                <div className="activity-stat">
                  <strong>{summary.documentsIssued}</strong>
                  <span>Docs</span>
                </div>
              </div>
            ) : null}

            {!editMode ? (
              <p className="muted small">
                Member since{' '}
                {summary
                  ? formatWhen(summary.memberSince)
                  : detail.data.createdAt
                    ? formatWhen(detail.data.createdAt)
                    : '—'}
                {summary?.lastActiveAt ? (
                  <>
                    <br />
                    Last active {formatWhen(summary.lastActiveAt)}
                  </>
                ) : null}
              </p>
            ) : null}

            {!editMode && detail.data.enrollments && detail.data.enrollments.length > 0 ? (
              <div className="learner-enrollments">
                <h3>Enrollments</h3>
                <ul>
                  {detail.data.enrollments.map((e, i) => (
                    <li key={i}>
                      {e.course.title}{' '}
                      <span className="muted">({e.status})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!editMode ? (
              <>
                <h3 className="activity-heading">Recent activity</h3>
                {activity.isLoading ? (
                  <p className="muted small">Loading activity…</p>
                ) : activity.error ? (
                  <p className="error small">Could not load activity</p>
                ) : activity.data && activity.data.items.length > 0 ? (
                  <ul className="activity-feed">
                    {activity.data.items.map((item) => (
                      <li key={item.id}>
                        <div className="activity-feed-meta">
                          <span className={`activity-kind kind-${item.kind}`}>
                            {kindLabel(item.kind)}
                          </span>
                          <time dateTime={item.occurredAt}>{formatWhen(item.occurredAt)}</time>
                        </div>
                        <p className="activity-feed-title">{item.title}</p>
                        {item.detail ? (
                          <p className="muted small activity-feed-detail">{item.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No activity recorded yet for this learner.</p>
                )}
              </>
            ) : null}
          </div>
        ) : (
          <p className="error">Failed to load learner</p>
        )}
      </ContentDrawer>
    </section>
  );
}
