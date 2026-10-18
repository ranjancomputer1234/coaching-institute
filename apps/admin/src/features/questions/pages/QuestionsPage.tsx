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
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
};

export function QuestionsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const create = useMutation({
    mutationFn: () => {
      const labels = [optA, optB, optC, optD].filter(Boolean);
      return apiFetch('/admin/questions', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          type: 'single_choice',
          options: labels.map((label, i) => ({
            label,
            isCorrect: i === correct,
            sortOrder: i,
          })),
        }),
      });
    },
    onSuccess: () => {
      setPrompt('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setDrawerOpen(false);
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

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Question bank</h1>
          <p>Single-choice questions (mobile-compatible)</p>
        </div>
        {hasPermission('assessments.author') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
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
                    <td>
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

      <ContentDrawer
        open={drawerOpen && hasPermission('assessments.author')}
        onClose={() => setDrawerOpen(false)}
        title="Add question"
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
            <label htmlFor="q-prompt">Prompt</label>
            <input
              id="q-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
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
                />{' '}
                Option {String(label)} (correct if selected)
              </label>
              <input
                value={String(value)}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                required={i < 2}
              />
            </div>
          ))}
          <button type="submit" className="btn" disabled={create.isPending}>
            Add question
          </button>
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
