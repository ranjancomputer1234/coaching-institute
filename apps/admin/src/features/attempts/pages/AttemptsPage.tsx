import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

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

export function AttemptsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [testId, setTestId] = useState('');
  const [learnerId, setLearnerId] = useState('');

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

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Attempts</h1>
          <p>Inspect and operate on test attempts</p>
        </div>
      </div>

      {hasPermission('assessments.author') ? (
        <form
          className="inline-form panel padded"
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
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && (list.data?.length ?? 0) === 0}
        emptyTitle="No attempts"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Test</th>
                <th>Status</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.learner.firstName} {a.learner.lastName}
                  </td>
                  <td>{a.test.title}</td>
                  <td>
                    <StatusPill value={a.status} />
                  </td>
                  <td>
                    {a.result
                      ? `${a.result.rawScore}/${a.result.maxScore} (${a.result.percentage.toFixed(0)}%)`
                      : '—'}
                  </td>
                  <td>
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
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
