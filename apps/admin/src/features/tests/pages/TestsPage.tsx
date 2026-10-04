import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Test = {
  id: string;
  title: string;
  mode: string;
  lifecycle: string;
  questionCount: number;
  maxScore: number;
  _count?: { questions: number; attempts: number };
};

type Question = { id: string; prompt: string; status: string };

export function TestsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const tests = useQuery({
    queryKey: ['tests'],
    queryFn: () => apiFetch<Test[]>('/admin/tests'),
  });
  const questions = useQuery({
    queryKey: ['questions', 'approved'],
    queryFn: () => apiFetch<Question[]>('/admin/questions?status=approved'),
  });

  const approved = useMemo(
    () => (questions.data ?? []).filter((q) => q.status === 'approved'),
    [questions.data],
  );

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/tests', {
        method: 'POST',
        body: JSON.stringify({ title, mode: 'formal', durationMinutes: 30 }),
      }),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });

  const setQs = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/tests/${selectedTest}/questions`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: selectedQuestions }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/tests/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tests</h1>
          <p>Build and publish formal/practice tests</p>
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
            <label htmlFor="test-title">Title</label>
            <input
              id="test-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn">
            Create draft
          </button>
        </form>
      ) : null}

      <PageState
        loading={tests.isLoading}
        error={tests.error instanceof Error ? tests.error : null}
        empty={!tests.isLoading && (tests.data?.length ?? 0) === 0}
        emptyTitle="No tests"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Mode</th>
                <th>Questions</th>
                <th>Max score</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(tests.data ?? []).map((test) => (
                <tr key={test.id}>
                  <td>{test.title}</td>
                  <td>{test.mode}</td>
                  <td>
                    {test._count?.questions ?? test.questionCount}/
                    {test.questionCount}
                  </td>
                  <td>{test.maxScore}</td>
                  <td>
                    <StatusPill value={test.lifecycle} />
                  </td>
                  <td className="action-row">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setSelectedTest(test.id);
                        setSelectedQuestions([]);
                      }}
                    >
                      Assign questions
                    </button>
                    {hasPermission('assessments.publish') &&
                    test.lifecycle !== 'published' ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => publish.mutate(test.id)}
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

      {selectedTest ? (
        <div className="panel padded" style={{ marginTop: '1rem' }}>
          <h2>Assign approved questions</h2>
          <div className="queue-list">
            {approved.map((q) => (
              <label key={q.id}>
                <input
                  type="checkbox"
                  checked={selectedQuestions.includes(q.id)}
                  onChange={(e) => {
                    setSelectedQuestions((prev) =>
                      e.target.checked
                        ? [...prev, q.id]
                        : prev.filter((id) => id !== q.id),
                    );
                  }}
                />{' '}
                {q.prompt}
              </label>
            ))}
          </div>
          <div className="action-row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn"
              disabled={!selectedQuestions.length || setQs.isPending}
              onClick={() => setQs.mutate()}
            >
              Save question set
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelectedTest(null)}
            >
              Close
            </button>
          </div>
          {setQs.error instanceof Error ? (
            <p className="error">{setQs.error.message}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
