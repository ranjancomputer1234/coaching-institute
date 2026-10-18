import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterWhen,
} from '../../../shared/lib/tableFilters';
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

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
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
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

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
  const summary = activity.data?.summary;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Learners</h1>
          <p>Search and manage learner accounts</p>
        </div>
      </div>

      <div className="split-panels learner-panels">
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
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>State</th>
                  <th>Batch</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No rows match filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((learner) => (
                  <tr
                    key={learner.id}
                    className={selectedId === learner.id ? 'row-selected' : ''}
                    onClick={() => setSelectedId(learner.id)}
                  >
                    <td>
                      {learner.firstName} {learner.lastName}
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
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PageState>

        <div className="panel padded learner-detail-panel">
          <h2>Profile</h2>
          {!selectedId ? (
            <p className="muted">Select a learner to inspect activity and account details.</p>
          ) : detail.isLoading ? (
            <p className="muted">Loading…</p>
          ) : detail.data ? (
            <>
              <p>
                <strong>
                  {detail.data.firstName} {detail.data.lastName}
                </strong>
              </p>
              <p className="muted small">{detail.data.id}</p>
              <dl className="drawer-dl learner-profile-dl">
                <dt>Email</dt>
                <dd>{detail.data.email ?? '—'}</dd>
                <dt>Phone</dt>
                <dd>{detail.data.phone ?? '—'}</dd>
                <dt>City</dt>
                <dd>{detail.data.city ?? '—'}</dd>
                <dt>Batch</dt>
                <dd>{detail.data.batch?.name ?? '—'}</dd>
                <dt>State</dt>
                <dd>
                  <StatusPill value={detail.data.accountState} />
                </dd>
              </dl>

              {summary ? (
                <div className="activity-summary">
                  <div className="activity-stat">
                    <strong>{summary.enrolledCourses}</strong>
                    <span>Courses</span>
                  </div>
                  <div className="activity-stat">
                    <strong>{summary.lessonsCompleted}</strong>
                    <span>Lessons done</span>
                  </div>
                  <div className="activity-stat">
                    <strong>{summary.testAttempts}</strong>
                    <span>Tests</span>
                  </div>
                  <div className="activity-stat">
                    <strong>{summary.documentsIssued}</strong>
                    <span>Documents</span>
                  </div>
                </div>
              ) : null}

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

              {detail.data.enrollments && detail.data.enrollments.length > 0 ? (
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

              {hasPermission('users.suspend') ? (
                <div className="action-row">
                  {detail.data.accountState === 'suspended' ? (
                    <button
                      type="button"
                      className="btn"
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
                  )}
                </div>
              ) : null}

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
          ) : (
            <p className="error">Failed to load learner</p>
          )}
        </div>
      </div>
    </section>
  );
}
