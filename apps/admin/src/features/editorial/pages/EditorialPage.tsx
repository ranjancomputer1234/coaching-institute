import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Item = {
  id: string;
  title: string;
  category: string | null;
  lifecycle: string;
  summary: string | null;
};

export function EditorialPage({
  kind,
  title,
  summary,
}: {
  kind: 'news' | 'awareness' | 'fact' | 'interview';
  title: string;
  summary: string;
}) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [itemTitle, setItemTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');

  const list = useQuery({
    queryKey: ['editorial', kind],
    queryFn: () => apiFetch<Item[]>(`/admin/editorial?kind=${kind}`),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/editorial', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          title: itemTitle,
          category: category || undefined,
          body: body || undefined,
        }),
      }),
    onSuccess: () => {
      setItemTitle('');
      setCategory('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['editorial', kind] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/editorial/${id}/publish`, { method: 'POST' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['editorial', kind] }),
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
      </div>
      {hasPermission('content.create') ? (
        <form
          className="inline-form panel padded"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor={`${kind}-title`}>Title</label>
            <input id={`${kind}-title`} value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor={`${kind}-category`}>Category</label>
            <input id={`${kind}-category`} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${kind}-body`}>Body</label>
            <input id={`${kind}-body`} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>Save draft</button>
        </form>
      ) : null}
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="Nothing published yet"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.category ?? '—'}</td>
                  <td><StatusPill value={row.lifecycle} /></td>
                  <td>
                    {row.lifecycle !== 'published' && hasPermission('content.publish') ? (
                      <button className="btn-ghost" type="button" onClick={() => publish.mutate(row.id)}>
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
    </section>
  );
}
