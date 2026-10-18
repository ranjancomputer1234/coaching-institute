import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { filterBySearch } from '../../../shared/lib/tableFilters';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

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
  const [search, setSearch] = useState('');
  const [published, setPublished] = useState('');
  const [passed, setPassed] = useState('');

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

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (r) =>
        `${r.attempt.learner.firstName} ${r.attempt.learner.lastName} ${r.attempt.test.title}`,
    );
    if (published === 'yes') next = next.filter((r) => r.published);
    if (published === 'no') next = next.filter((r) => !r.published);
    if (passed === 'yes') next = next.filter((r) => r.passed);
    if (passed === 'no') next = next.filter((r) => !r.passed);
    return next;
  }, [rows, search, published, passed]);

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
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No results yet"
        emptyHint="Submit an attempt to generate a scored result."
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search learner or test…',
          }}
          selects={[
            {
              id: 'published',
              label: 'Published',
              value: published,
              onChange: setPublished,
              options: [
                { value: 'yes', label: 'Published' },
                { value: 'no', label: 'Unpublished' },
              ],
            },
            {
              id: 'passed',
              label: 'Pass',
              value: passed,
              onChange: setPassed,
              options: [
                { value: 'yes', label: 'Passed' },
                { value: 'no', label: 'Failed' },
              ],
            },
          ]}
          onReset={() => {
            setSearch('');
            setPublished('');
            setPassed('');
          }}
        />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
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
                      <StatusPill value={r.published ? 'published' : 'unpublished'} />
                    </td>
                    <td>
                      {!r.published && hasPermission('assessments.publish') ? (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
