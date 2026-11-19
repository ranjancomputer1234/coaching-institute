import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { confirmDelete } from '../../../shared/lib/confirmDelete';
import { usePersistedViewMode } from '../../../shared/lib/usePersistedViewMode';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { LayoutViewToggle } from '../../../shared/ui/LayoutViewToggle';
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
  pricing?: string | null;
  durationMinutes?: number | null;
  examId?: string | null;
  description?: string | null;
  _count?: { questions: number; attempts: number };
};

type TestDetail = Test & {
  questions?: Array<{
    questionId: string;
    question: { id: string; prompt: string; status: string };
  }>;
};

type Question = { id: string; prompt: string; status: string };

type DrawerMode = 'create' | 'view' | 'edit' | 'assign';

export function TestsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canAuthor = hasPermission('assessments.author');
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [draftMode, setDraftMode] = useState('practice');
  const [draftPricing, setDraftPricing] = useState('free');
  const [examId, setExamId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [mode, setMode] = useState('');
  const [viewMode, setViewMode] = usePersistedViewMode('admin.tests.view');

  const tests = useQuery({
    queryKey: ['tests'],
    queryFn: () => apiFetch<Test[]>('/admin/tests'),
  });
  const exams = useQuery({
    queryKey: ['exams'],
    queryFn: () => apiFetch<Array<{ id: string; title: string }>>('/admin/exams'),
    enabled: drawerMode === 'create' || drawerMode === 'edit' || drawerMode === 'view',
  });
  const questions = useQuery({
    queryKey: ['questions', 'approved'],
    queryFn: () => apiFetch<Question[]>('/admin/questions?status=approved'),
  });
  const detail = useQuery({
    queryKey: ['test', editingId],
    enabled: Boolean(editingId) && (drawerMode === 'view' || drawerMode === 'edit' || drawerMode === 'assign'),
    queryFn: () => apiFetch<TestDetail>(`/admin/tests/${editingId}`),
  });

  const approved = useMemo(
    () => (questions.data ?? []).filter((q) => q.status === 'approved'),
    [questions.data],
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDraftMode('practice');
    setDraftPricing('free');
    setExamId('');
    setDurationMinutes('30');
    setSelectedQuestions([]);
  };

  const openCreate = () => {
    resetForm();
    setDrawerMode('create');
  };

  const openView = (test: Test) => {
    setEditingId(test.id);
    setTitle(test.title);
    setDraftMode(test.mode || 'practice');
    setDraftPricing(test.pricing || 'free');
    setExamId(test.examId || '');
    setDurationMinutes(String(test.durationMinutes ?? 30));
    setDrawerMode('view');
  };

  const openEdit = (test: Test) => {
    setEditingId(test.id);
    setTitle(test.title);
    setDraftMode(test.mode || 'practice');
    setDraftPricing(test.pricing || 'free');
    setExamId(test.examId || '');
    setDurationMinutes(String(test.durationMinutes ?? 30));
    setDrawerMode('edit');
  };

  const openAssign = (test: Test) => {
    setEditingId(test.id);
    setSelectedQuestions([]);
    setDrawerMode('assign');
  };

  const closeDrawer = () => {
    setDrawerMode(null);
    resetForm();
  };

  useEffect(() => {
    if (!detail.data || !editingId) return;
    if (drawerMode === 'view' || drawerMode === 'edit') {
      setTitle(detail.data.title);
      setDraftMode(detail.data.mode || 'practice');
      setDraftPricing(detail.data.pricing || 'free');
      setExamId(detail.data.examId || '');
      setDurationMinutes(String(detail.data.durationMinutes ?? 30));
    }
    if (drawerMode === 'assign' && detail.data.questions) {
      setSelectedQuestions(detail.data.questions.map((q) => q.questionId));
    }
  }, [detail.data, editingId, drawerMode]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title,
        mode: draftMode,
        pricing: draftPricing,
        durationMinutes: Number(durationMinutes) || 30,
        ...(examId ? { examId } : {}),
      };
      if (drawerMode === 'edit' && editingId) {
        return apiFetch(`/admin/tests/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/admin/tests', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['tests'] });
    },
  });

  const setQs = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/tests/${editingId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ questionIds: selectedQuestions }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      queryClient.invalidateQueries({ queryKey: ['test', editingId] });
      closeDrawer();
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/tests/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tests'] }),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/tests/${id}/archive`, { method: 'POST' }),
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

  const assignTest = rows.find((t) => t.id === editingId);
  const readOnly = drawerMode === 'view';
  const formOpen = drawerMode === 'create' || drawerMode === 'view' || drawerMode === 'edit';
  const formTitle =
    drawerMode === 'view'
      ? 'View test'
      : drawerMode === 'edit'
        ? 'Edit test'
        : 'Create test draft';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tests</h1>
          <p>Build and publish formal/practice tests</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          {canAuthor ? (
            <button type="button" className="btn" onClick={openCreate}>
              Create draft
            </button>
          ) : null}
        </PageHeaderActions>
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
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filtered.length === 0 ? (
              <p className="muted">No rows match filters.</p>
            ) : (
              filtered.map((test) => (
                <div key={test.id} className="entity-card">
                  <div className="entity-card-cover-empty" />
                  <div className="entity-card-meta">
                    <strong>{test.title}</strong>
                    <StatusPill value={test.lifecycle} />
                    <span className="muted small">
                      {test.mode} · {test._count?.questions ?? test.questionCount}/{test.questionCount} questions
                    </span>
                  </div>
                  <div className="entity-card-actions action-row">
                    <button type="button" className="btn btn-ghost" onClick={() => openView(test)}>View</button>
                    {canAuthor ? <button type="button" className="btn btn-ghost" onClick={() => openEdit(test)}>Edit</button> : null}
                    <button type="button" className="btn btn-ghost" onClick={() => openAssign(test)}>Assign Qs</button>
                    {hasPermission('assessments.publish') && test.lifecycle !== 'published' ? (
                      <button type="button" className="btn" onClick={() => publish.mutate(test.id)}>Publish</button>
                    ) : null}
                    {canAuthor && test.lifecycle !== 'archived' ? (
                      <button
                        type="button"
                        className="btn btn-danger-ghost"
                        onClick={() => { if (confirmDelete(test.title)) archive.mutate(test.id); }}
                      >
                        Delete
                      </button>
                    ) : null}
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
                filtered.map((test) => (
                  <li key={test.id}>
                    <div className="entity-compact-main">
                      <strong>{test.title}</strong>
                      <span className="muted small">{test.mode} · {test._count?.questions ?? test.questionCount} questions</span>
                      <StatusPill value={test.lifecycle} />
                    </div>
                    <div className="entity-card-actions action-row">
                      <button type="button" className="btn btn-ghost" onClick={() => openView(test)}>View</button>
                      {canAuthor ? <button type="button" className="btn btn-ghost" onClick={() => openEdit(test)}>Edit</button> : null}
                      {hasPermission('assessments.publish') && test.lifecycle !== 'published' ? (
                        <button type="button" className="btn" onClick={() => publish.mutate(test.id)}>Publish</button>
                      ) : null}
                      {canAuthor && test.lifecycle !== 'archived' ? (
                        <button
                          type="button"
                          className="btn btn-danger-ghost"
                          onClick={() => { if (confirmDelete(test.title)) archive.mutate(test.id); }}
                        >
                          Delete
                        </button>
                      ) : null}
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
                        <button type="button" className="btn btn-ghost" onClick={() => openView(test)}>View</button>
                        {canAuthor ? (
                          <button type="button" className="btn btn-ghost" onClick={() => openEdit(test)}>Edit</button>
                        ) : null}
                        <button type="button" className="btn btn-ghost" onClick={() => openAssign(test)}>
                          Assign questions
                        </button>
                        {hasPermission('assessments.publish') && test.lifecycle !== 'published' ? (
                          <button type="button" className="btn" onClick={() => publish.mutate(test.id)}>Publish</button>
                        ) : null}
                        {canAuthor && test.lifecycle !== 'archived' ? (
                          <button
                            type="button"
                            className="btn btn-danger-ghost"
                            onClick={() => { if (confirmDelete(test.title)) archive.mutate(test.id); }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </PageState>

      <ContentDrawer open={formOpen} onClose={closeDrawer} title={formTitle} size="full">
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (readOnly) return;
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="test-exam">Exam</label>
            <select
              id="test-exam"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              disabled={readOnly}
            >
              <option value="">Not attached to an exam</option>
              {(exams.data ?? []).map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
            <p className="field-hint">Exam detail only lists tests that include this exam.</p>
          </div>
          <div className="field">
            <label htmlFor="test-mode">Mode</label>
            <select
              id="test-mode"
              value={draftMode}
              onChange={(e) => setDraftMode(e.target.value)}
              disabled={readOnly}
            >
              <option value="practice">Practice</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="test-pricing">Pricing</label>
            <select
              id="test-pricing"
              value={draftPricing}
              onChange={(e) => setDraftPricing(e.target.value)}
              disabled={readOnly}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="test-duration">Duration (minutes)</label>
            <input
              id="test-duration"
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="test-title">Title</label>
            <input
              id="test-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          {drawerMode === 'view' && detail.data?.questions ? (
            <div className="field">
              <label>Assigned questions</label>
              <ul className="queue-list">
                {detail.data.questions.length === 0 ? (
                  <li className="muted">None assigned yet</li>
                ) : (
                  detail.data.questions.map((q) => (
                    <li key={q.questionId}>{q.question.prompt}</li>
                  ))
                )}
              </ul>
            </div>
          ) : null}
          {drawerMode === 'view' && canAuthor ? (
            <button type="button" className="btn" onClick={() => setDrawerMode('edit')}>
              Edit test
            </button>
          ) : null}
          {!readOnly ? (
            <button type="submit" className="btn" disabled={save.isPending}>
              {drawerMode === 'edit' ? 'Save changes' : 'Create draft'}
            </button>
          ) : null}
          {save.error instanceof Error ? (
            <p className="error">{save.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>

      <ContentDrawer
        open={drawerMode === 'assign'}
        onClose={closeDrawer}
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
