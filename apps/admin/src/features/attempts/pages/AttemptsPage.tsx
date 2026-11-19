import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Attempt = {
  id: string;
  status: string;
  startedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  test: { id: string; title: string };
  learner: { id: string; firstName: string; lastName: string };
  result?: {
    id: string;
    rawScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    published: boolean;
  } | null;
};

type Test = { id: string; title: string; lifecycle: string };
type Learner = { id: string; firstName: string; lastName: string };

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function AttemptsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [testId, setTestId] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // View drawer state
  const [viewAttempt, setViewAttempt] = useState<Attempt | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const list = useQuery({
    queryKey: ['attempts'],
    queryFn: () => apiFetch<Attempt[]>('/admin/attempts'),
  });
  const tests = useQuery({
    queryKey: ['tests'],
    queryFn: () => apiFetch<Test[]>('/admin/tests'),
  });
  const learners = useQuery({
    queryKey: ['learners'],
    queryFn: () => apiFetch<Learner[]>('/admin/learners'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/attempts', {
        method: 'POST',
        body: JSON.stringify({ testId, learnerId }),
      }),
    onSuccess: () => {
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
    },
  });

  const submit = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/attempts/${id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (a) =>
        `${a.learner.firstName} ${a.learner.lastName} ${a.test.title} ${a.status}`,
    );
    next = filterWhen(next, status, (a, v) => a.status === v);
    next = filterByDateRange(next, dateFrom, dateTo, (a) => a.startedAt);
    return next;
  }, [rows, search, status, dateFrom, dateTo]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((a) => a.status)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Attempts</h1>
          <p>Inspect and operate on test attempts</p>
        </div>
        {hasPermission('assessments.author') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              Start attempt
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No attempts"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search learner or test…',
          }}
          dateFrom={{ value: dateFrom, onChange: setDateFrom, label: 'Started from' }}
          dateTo={{ value: dateTo, onChange: setDateTo, label: 'Started to' }}
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
                <th>Learner</th>
                <th>Test</th>
                <th>Status</th>
                <th>Started</th>
                <th>Score</th>
                <th>Actions</th>
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
                filtered.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.learner.firstName} {a.learner.lastName}
                    </td>
                    <td>{a.test.title}</td>
                    <td>
                      <StatusPill value={a.status} />
                    </td>
                    <td>{new Date(a.startedAt).toLocaleDateString()}</td>
                    <td>
                      {a.result
                        ? `${a.result.rawScore}/${a.result.maxScore} (${a.result.percentage.toFixed(0)}%)`
                        : '—'}
                    </td>
                    <td className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => { setViewAttempt(a); setViewOpen(true); }}
                      >
                        View
                      </button>
                      {a.status === 'in_progress' || a.status === 'created' ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => submit.mutate(a.id)}
                        >
                          Force submit & score
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

      {/* View drawer */}
      <ContentDrawer
        open={viewOpen}
        onClose={() => { setViewOpen(false); setViewAttempt(null); }}
        title="View attempt"
      >
        {viewAttempt ? (
          <dl className="drawer-dl">
            <dt>ID</dt>
            <dd className="muted small">{viewAttempt.id}</dd>
            <dt>Learner</dt>
            <dd>{viewAttempt.learner.firstName} {viewAttempt.learner.lastName}</dd>
            <dt>Learner ID</dt>
            <dd className="muted small">{viewAttempt.learner.id}</dd>
            <dt>Test</dt>
            <dd>{viewAttempt.test.title}</dd>
            <dt>Test ID</dt>
            <dd className="muted small">{viewAttempt.test.id}</dd>
            <dt>Status</dt>
            <dd><StatusPill value={viewAttempt.status} /></dd>
            <dt>Started</dt>
            <dd>{fmt(viewAttempt.startedAt)}</dd>
            <dt>Expires</dt>
            <dd>{fmt(viewAttempt.expiresAt)}</dd>
            <dt>Submitted</dt>
            <dd>{fmt(viewAttempt.submittedAt)}</dd>
            {viewAttempt.result ? (
              <>
                <dt>Score</dt>
                <dd>
                  {viewAttempt.result.rawScore}/{viewAttempt.result.maxScore}
                  {' '}({viewAttempt.result.percentage.toFixed(0)}%)
                </dd>
                <dt>Passed</dt>
                <dd>{viewAttempt.result.passed ? 'Yes' : 'No'}</dd>
                <dt>Result published</dt>
                <dd>{viewAttempt.result.published ? 'Yes' : 'No'}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </ContentDrawer>

      {/* Create drawer */}
      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Start attempt"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="attempt-test">Published test</label>
            <select
              id="attempt-test"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              required
            >
              <option value="">Select test</option>
              {(tests.data ?? [])
                .filter((t) => t.lifecycle === 'published')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="attempt-learner">Learner</label>
            <select
              id="attempt-learner"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              required
            >
              <option value="">Select learner</option>
              {(learners.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName} {l.lastName}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            Start attempt
          </button>
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
