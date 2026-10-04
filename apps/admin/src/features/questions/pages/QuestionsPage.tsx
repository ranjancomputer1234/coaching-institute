import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

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
  const [prompt, setPrompt] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState(0);

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
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/questions/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Question bank</h1>
          <p>Single-choice questions (mobile-compatible)</p>
        </div>
      </div>

      {hasPermission('assessments.author') ? (
        <form
          className="panel padded"
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
          <div className="inline-form">
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
                  onChange={(e) =>
                    (setter as (v: string) => void)(e.target.value)
                  }
                  required={i < 2}
                />
              </div>
            ))}
          </div>
          <button type="submit" className="btn" disabled={create.isPending}>
            Add question
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
        emptyTitle="No questions yet"
      >
        <div className="panel" style={{ marginTop: '1rem' }}>
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
              {(list.data ?? []).map((q) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
