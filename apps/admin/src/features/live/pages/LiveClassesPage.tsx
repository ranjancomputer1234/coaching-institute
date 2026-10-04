import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type LiveClass = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  provider: string;
  hostName: string | null;
};

export function LiveClassesPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [notice, setNotice] = useState('');

  const list = useQuery({
    queryKey: ['live-classes'],
    queryFn: () => apiFetch<LiveClass[]>('/admin/live-classes'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/live-classes', {
        method: 'POST',
        body: JSON.stringify({
          title,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const schedule = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ message?: string }>(`/admin/live-classes/${id}/schedule`, {
        method: 'POST',
      }),
    onSuccess: (result) => {
      setNotice(result.message ?? 'Updated');
      queryClient.invalidateQueries({ queryKey: ['live-classes'] });
    },
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Live classes</h1>
          <p>Schedule classes. A join link is created only when a live provider is configured.</p>
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
          <label htmlFor="live-title">Title</label>
          <input id="live-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="live-start">Starts</label>
          <input id="live-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="live-end">Ends</label>
          <input id="live-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={create.isPending}>Save draft</button>
      </form>
      {notice ? <p className="muted">{notice}</p> : null}
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No live classes"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Starts</th>
                <th>Provider</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{new Date(row.startsAt).toLocaleString()}</td>
                  <td>{row.provider}</td>
                  <td><StatusPill value={row.status} /></td>
                  <td>
                    <button className="btn-ghost" type="button" onClick={() => schedule.mutate(row.id)}>
                      Request room
                    </button>
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
