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

type Question = {
  id: string;
  prompt: string;
  status: string;
  marks: number;
  subject: string | null;
  explanation?: string | null;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
};

type DrawerMode = 'create' | 'view' | 'edit';

export function QuestionsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canAuthor = hasPermission('assessments.author');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>('create');
  const [editing, setEditing] = useState<Question | null>(null);
  const [prompt, setPrompt] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');

  const list = useQuery({
    queryKey: ['questions'],
    queryFn: () => apiFetch<Question[]>('/admin/questions'),
  });

  const resetForm = () => {
    setEditing(null);
    setPrompt('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setCorrect(0);
  };

  const fillForm = (q: Question) => {
    setEditing(q);
    setPrompt(q.prompt);
    setOptA(q.options[0]?.label ?? '');
    setOptB(q.options[1]?.label ?? '');
    setOptC(q.options[2]?.label ?? '');
    setOptD(q.options[3]?.label ?? '');
    const correctIndex = q.options.findIndex((o) => o.isCorrect);
    setCorrect(correctIndex >= 0 ? correctIndex : 0);
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
    setDrawerOpen(true);
  };

  const openView = (q: Question) => {
    fillForm(q);
    setMode('view');
    setDrawerOpen(true);
  };

  const openEdit = (q: Question) => {
    fillForm(q);
    setMode('edit');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const save = useMutation({
    mutationFn: () => {
      const labels = [optA, optB, optC, optD].filter(Boolean);
      const body = {
        prompt,
        type: 'single_choice',
        options: labels.map((label, i) => ({
          label,
          isCorrect: i === correct,
          sortOrder: i,
        })),
      };
      if (mode === 'edit' && editing) {
        return apiFetch(`/admin/questions/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      return apiFetch('/admin/questions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/questions/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (q) => `${q.prompt} ${q.subject ?? ''}`);
    next = filterWhen(next, status, (q, v) => q.status === v);
    next = filterWhen(next, subject, (q, v) => (q.subject ?? '') === v);
    return next;
  }, [rows, search, status, subject]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((q) => q.status)),
    [rows],
  );
  const subjectOptions = useMemo(
    () => distinctOptions(rows.map((q) => q.subject ?? '')),
    [rows],
  );

  const readOnly = mode === 'view';
  const drawerTitle =
    mode === 'view' ? 'View question' : mode === 'edit' ? 'Edit question' : 'Add question';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Question bank</h1>
          <p>Single-choice questions (mobile-compatible)</p>
        </div>
        {canAuthor ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={openCreate}>
              Add question
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No questions yet"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search prompt…',
          }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: statusOptions,
            },
            {
              id: 'subject',
              label: 'Subject',
              value: subject,
              onChange: setSubject,
              options: subjectOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setStatus('');
            setSubject('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Prompt</th>
                <th>Marks</th>
                <th>Status</th>
                <th>Options</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id}>
                    <td>{q.prompt}</td>
                    <td>{q.marks}</td>
                    <td>
                      <StatusPill value={q.status} />
                    </td>
                    <td className="muted">
                      {q.options.map((o) => (
                        <div key={o.id}>
                          {o.isCorrect ? '✓ ' : ''}
                          {o.label}
                        </div>
                      ))}
                    </td>
                    <td className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => openView(q)}
                      >
                        View
                      </button>
                      {canAuthor ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEdit(q)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {hasPermission('assessments.publish') &&
                      q.status !== 'approved' ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => approve.mutate(q.id)}
                        >
                          Approve
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

      <ContentDrawer open={drawerOpen} onClose={closeDrawer} title={drawerTitle} size="full">
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (readOnly) return;
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="q-prompt">Prompt</label>
            <input
              id="q-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          {[
            [optA, setOptA, 'A'],
            [optB, setOptB, 'B'],
            [optC, setOptC, 'C'],
            [optD, setOptD, 'D'],
          ].map(([value, setter, label], i) => (
            <div className="field" key={String(label)}>
              <label>
                <input
                  type="radio"
                  name="correct"
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  disabled={readOnly}
                />{' '}
                Option {String(label)} (correct if selected)
              </label>
              <input
                value={String(value)}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                required={i < 2}
                readOnly={readOnly}
                disabled={readOnly}
              />
            </div>
          ))}
          {mode === 'view' && canAuthor ? (
            <button type="button" className="btn" onClick={() => setMode('edit')}>
              Edit question
            </button>
          ) : null}
          {!readOnly ? (
            <button type="submit" className="btn" disabled={save.isPending}>
              {mode === 'edit' ? 'Save changes' : 'Add question'}
            </button>
          ) : null}
          {save.error instanceof Error ? (
            <p className="error">{save.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
