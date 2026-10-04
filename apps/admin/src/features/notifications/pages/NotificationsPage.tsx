import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Campaign = {
  id: string;
  title: string;
  audience: string;
  status: string;
  providerStatus: string;
  failureReason: string | null;
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('single');
  const [audienceRef, setAudienceRef] = useState('');

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<Campaign[]>('/admin/notifications'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          audience,
          audienceRef: audienceRef || undefined,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      setAudienceRef('');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const send = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/notifications/${id}/send`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>Draft campaigns. Send stays unsent until a push provider is configured.</p>
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
          <label htmlFor="note-title">Title</label>
          <input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="note-body">Message</label>
          <input id="note-body" value={body} onChange={(e) => setBody(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="note-audience">Audience</label>
          <select id="note-audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="single">Single learner</option>
            <option value="segment">Segment</option>
            <option value="all">All learners</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="note-ref">Audience ref</label>
          <input id="note-ref" value={audienceRef} placeholder="learner id or batch id" onChange={(e) => setAudienceRef(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={create.isPending}>Save draft</button>
      </form>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No campaigns"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Audience</th>
                <th>Status</th>
                <th>Provider</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.audience}</td>
                  <td><StatusPill value={row.status} /></td>
                  <td>{row.providerStatus}</td>
                  <td>
                    <button className="btn-ghost" type="button" onClick={() => send.mutate(row.id)}>
                      Send
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
      {send.error instanceof Error ? <p className="error">{send.error.message}</p> : null}
    </section>
  );
}
