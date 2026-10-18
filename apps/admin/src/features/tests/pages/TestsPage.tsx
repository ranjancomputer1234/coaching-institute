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
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [mode, setMode] = useState('');

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
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });

  const setQs = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/tests/${selectedTest}/questions`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: selectedQuestions }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setSelectedTest(null);
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/tests/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  const rows = tests.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (t) => `${t.title} ${t.mode}`);
    next = filterWhen(next, lifecycle, (t, v) => t.lifecycle === v);
    next = filterWhen(next, mode, (t, v) => t.mode === v);
    return next;
  }, [rows, search, lifecycle, mode]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((t) => t.lifecycle)),
    [rows],
  );
  const modeOptions = useMemo(() => distinctOptions(rows.map((t) => t.mode)), [rows]);

  const assignTest = rows.find((t) => t.id === selectedTest);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tests</h1>
          <p>Build and publish formal/practice tests</p>
        </div>
        {hasPermission('assessments.author') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setCreateOpen(true)}>
              Create draft
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={tests.isLoading}
        error={tests.error instanceof Error ? tests.error : null}
        empty={!tests.isLoading && rows.length === 0}
        emptyTitle="No tests"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title…',
          }}
          selects={[
            {
              id: 'lifecycle',
              label: 'State',
              value: lifecycle,
              onChange: setLifecycle,
              options: lifecycleOptions,
            },
            {
              id: 'mode',
              label: 'Mode',
              value: mode,
              onChange: setMode,
              options: modeOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setMode('');
          }}
        />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((test) => (
                  <tr key={test.id}>
                    <td>{test.title}</td>
                    <td>{test.mode}</td>
                    <td>
                      {test._count?.questions ?? test.questionCount}/{test.questionCount}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create test draft"
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
      </ContentDrawer>

      <ContentDrawer
        open={Boolean(selectedTest)}
        onClose={() => setSelectedTest(null)}
        title={assignTest ? `Assign questions — ${assignTest.title}` : 'Assign questions'}
        size="full"
      >
        <div className="queue-list">
          {approved.map((q) => (
            <label key={q.id}>
              <input
                type="checkbox"
                checked={selectedQuestions.includes(q.id)}
                onChange={(e) => {
                  setSelectedQuestions((prev) =>
                    e.target.checked ? [...prev, q.id] : prev.filter((id) => id !== q.id),
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
        </div>
        {setQs.error instanceof Error ? (
          <p className="error">{setQs.error.message}</p>
        ) : null}
      </ContentDrawer>
    </section>
  );
}
