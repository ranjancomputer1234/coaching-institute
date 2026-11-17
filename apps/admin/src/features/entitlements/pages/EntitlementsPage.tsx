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

type Entitlement = {
  id: string;
  learnerId: string;
  courseId: string | null;
  source: string;
  state: string;
  grantReason: string | null;
  productKey: string | null;
  learner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  course?: { id: string; title: string } | null;
};

type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

type Course = {
  id: string;
  title: string;
  commercialMode: string;
  lifecycle: string;
};

function learnerLabel(l: {
  firstName: string;
  lastName: string;
  email: string | null;
}) {
  return `${l.firstName} ${l.lastName}`.trim() || l.email || 'Learner';
}

export function EntitlementsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [learnerId, setLearnerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['entitlements'],
    queryFn: () => apiFetch<Entitlement[]>('/admin/entitlements'),
  });

  const learners = useQuery({
    queryKey: ['learners', 'entitlement-picker'],
    queryFn: () => apiFetch<Learner[]>('/admin/learners'),
    enabled: drawerOpen,
  });

  const courses = useQuery({
    queryKey: ['courses', 'entitlement-picker'],
    queryFn: () => apiFetch<Course[]>('/admin/courses'),
    enabled: drawerOpen,
  });

  const grant = useMutation({
    mutationFn: () =>
      apiFetch('/admin/entitlements/grant', {
        method: 'POST',
        body: JSON.stringify({
          learnerId,
          courseId,
          source: 'manual',
          grantReason: grantReason.trim() || 'Manual staff grant',
        }),
      }),
    onSuccess: () => {
      setDrawerOpen(false);
      setLearnerId('');
      setCourseId('');
      setGrantReason('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Grant failed');
    },
  });

  const revoke = useMutation({
    mutationFn: () => {
      if (!revokeId) throw new Error('Choose an entitlement');
      return apiFetch(`/admin/entitlements/${revokeId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: revokeReason.trim() }),
      });
    },
    onSuccess: () => {
      setRevokeId(null);
      setRevokeReason('');
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (row) =>
        `${row.learner ? learnerLabel(row.learner) : ''} ${row.learner?.email ?? ''} ${row.course?.title ?? ''} ${row.courseId ?? ''} ${row.source} ${row.grantReason ?? ''}`,
    );
    next = filterWhen(next, stateFilter, (row, value) => row.state === value);
    return next;
  }, [rows, search, stateFilter]);

  const stateOptions = useMemo(
    () => distinctOptions(rows.map((row) => row.state)),
    [rows],
  );

  const paidCourses = useMemo(
    () =>
      (courses.data ?? []).filter(
        (course) =>
          course.commercialMode === 'paid' || course.lifecycle === 'published',
      ),
    [courses.data],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Entitlements</h1>
          <p>
            Grant or revoke paid course access. Reconciling a paid order also grants
            access when the product is linked to a course.
          </p>
        </div>
        {hasPermission('enrollments.create') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              Grant access
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No entitlements yet"
        emptyHint="Grant access manually, or reconcile a paid order with a course-linked product."
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search learner, course, reason…',
          }}
          selects={[
            {
              id: 'state',
              label: 'State',
              value: stateFilter,
              onChange: setStateFilter,
              options: stateOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setStateFilter('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Course</th>
                <th>Source</th>
                <th>State</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.learner ? learnerLabel(row.learner) : row.learnerId}
                      {row.learner?.email ? (
                        <div className="muted small">{row.learner.email}</div>
                      ) : null}
                    </td>
                    <td>{row.course?.title ?? row.courseId ?? '—'}</td>
                    <td>{row.source}</td>
                    <td>
                      <StatusPill value={row.state} />
                    </td>
                    <td className="muted">{row.grantReason ?? '—'}</td>
                    <td>
                      {hasPermission('enrollments.revoke') &&
                      row.state === 'active' ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setRevokeId(row.id);
                            setRevokeReason('');
                          }}
                        >
                          Revoke
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
        onClose={() => {
          if (grant.isPending) return;
          setDrawerOpen(false);
        }}
        title="Grant course access"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            if (!learnerId || !courseId) {
              setFormError('Choose a learner and a course');
              return;
            }
            grant.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="ent-learner">Learner</label>
            <select
              id="ent-learner"
              value={learnerId}
              onChange={(event) => setLearnerId(event.target.value)}
              required
            >
              <option value="">Select learner…</option>
              {(learners.data ?? []).map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {learnerLabel(learner)}
                  {learner.email ? ` (${learner.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ent-course">Course</label>
            <select
              id="ent-course"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              required
            >
              <option value="">Select course…</option>
              {paidCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title} ({course.commercialMode})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ent-reason">Reason</label>
            <input
              id="ent-reason"
              value={grantReason}
              onChange={(event) => setGrantReason(event.target.value)}
              placeholder="Scholarship, support unlock, etc."
            />
          </div>
          {formError ? <p className="error">{formError}</p> : null}
          {grant.error instanceof Error ? (
            <p className="error">{grant.error.message}</p>
          ) : null}
          <button type="submit" className="btn" disabled={grant.isPending}>
            {grant.isPending ? 'Granting…' : 'Grant access'}
          </button>
        </form>
      </ContentDrawer>

      <ContentDrawer
        open={revokeId !== null}
        onClose={() => {
          if (revoke.isPending) return;
          setRevokeId(null);
        }}
        title="Revoke entitlement"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            revoke.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="ent-revoke-reason">Reason</label>
            <input
              id="ent-revoke-reason"
              value={revokeReason}
              onChange={(event) => setRevokeReason(event.target.value)}
              required
              minLength={3}
            />
          </div>
          {revoke.error instanceof Error ? (
            <p className="error">{revoke.error.message}</p>
          ) : null}
          <button
            type="submit"
            className="btn"
            disabled={revoke.isPending || revokeReason.trim().length < 3}
          >
            {revoke.isPending ? 'Revoking…' : 'Revoke access'}
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
