import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type ResultRow = {
  id: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  published: boolean;
  attempt: {
    test: { id: string; title: string };
    learner: { firstName: string; lastName: string };
  };
};

export function ResultsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['results'],
    queryFn: () => apiFetch<ResultRow[]>('/admin/results'),
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/results/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Published from admin results page' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['results'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Results</h1>
          <p>Review and publish scored attempts</p>
        </div>
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && (list.data?.length ?? 0) === 0}
        emptyTitle="No results yet"
        emptyHint="Submit an attempt to generate a scored result."
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Test</th>
                <th>Score</th>
                <th>Pass</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.attempt.learner.firstName} {r.attempt.learner.lastName}
                  </td>
                  <td>{r.attempt.test.title}</td>
                  <td>
                    {r.rawScore}/{r.maxScore} ({r.percentage.toFixed(0)}%)
                  </td>
                  <td>{r.passed ? 'Yes' : 'No'}</td>
                  <td>
                    <StatusPill
                      value={r.published ? 'published' : 'unpublished'}
                    />
                  </td>
                  <td>
                    {hasPermission('results.publish') && !r.published ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => publish.mutate(r.id)}
                      >
                        Publish
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
