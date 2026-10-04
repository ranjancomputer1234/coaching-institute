import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type SupportCase = {
  id: string;
  subject: string;
  body: string;
  status: string;
  learnerId: string | null;
};

export function SupportPage() {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const list = useQuery({
    queryKey: ['support'],
    queryFn: () => apiFetch<SupportCase[]>('/admin/support-cases'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/support-cases', {
        method: 'POST',
        body: JSON.stringify({ subject, body }),
      }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['support'] });
    },
  });

  const close = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/support-cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Support</h1>
          <p>Cases opened by staff for learner issues</p>
        </div>
      </div>
      <form
        className="inline-form panel padded"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="support-subject">Subject</label>
          <input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="support-body">Details</label>
          <input id="support-body" value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={create.isPending}>Open case</button>
      </form>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No open cases"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Details</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.subject}</td>
                  <td>{row.body}</td>
                  <td><StatusPill value={row.status} /></td>
                  <td>
                    {row.status !== 'closed' ? (
                      <button className="btn-ghost" type="button" onClick={() => close.mutate(row.id)}>
                        Close
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
