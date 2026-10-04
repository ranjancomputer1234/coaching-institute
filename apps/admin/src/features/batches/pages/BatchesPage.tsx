import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Batch = {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  _count?: { learners: number };
};

export function BatchesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');

  const list = useQuery({
    queryKey: ['batches'],
    queryFn: () => apiFetch<Batch[]>('/admin/batches'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/batches', {
        method: 'POST',
        body: JSON.stringify({ name, subject: subject || undefined }),
      }),
    onSuccess: () => {
      setName('');
      setSubject('');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Batches</h1>
          <p>Cohorts learners are assigned to</p>
        </div>
      </div>

      {hasPermission('enrollments.create') ? (
        <form
          className="inline-form panel padded"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="batch-name">Name</label>
            <input
              id="batch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="batch-subject">Subject</label>
            <input
              id="batch-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Add batch
          </button>
        </form>
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No batches yet"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Learners</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.name}</td>
                  <td>{batch.subject ?? '—'}</td>
                  <td>{batch._count?.learners ?? 0}</td>
                  <td>
                    <StatusPill value={batch.status} />
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
