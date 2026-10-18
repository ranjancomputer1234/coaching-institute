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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [catFilter, setCatFilter] = useState('');

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
      setDrawerOpen(false);
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
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (r) => `${r.title} ${r.category ?? ''} ${r.summary ?? ''}`);
    next = filterWhen(next, lifecycle, (r, v) => r.lifecycle === v);
    next = filterWhen(next, catFilter, (r, v) => (r.category ?? '') === v);
    return next;
  }, [rows, search, lifecycle, catFilter]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.lifecycle)),
    [rows],
  );
  const categoryOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.category ?? '')),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
        {hasPermission('content.create') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              Save draft
            </button>
          </PageHeaderActions>
        ) : null}
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="Nothing published yet"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title or category…',
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
              id: 'category',
              label: 'Category',
              value: catFilter,
              onChange: setCatFilter,
              options: categoryOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setCatFilter('');
          }}
        />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.category ?? '—'}</td>
                    <td>
                      <StatusPill value={row.lifecycle} />
                    </td>
                    <td>
                      {row.lifecycle !== 'published' && hasPermission('content.publish') ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => publish.mutate(row.id)}
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
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="New draft"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor={`${kind}-title`}>Title</label>
            <input
              id={`${kind}-title`}
              value={itemTitle}
              onChange={(e) => setItemTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${kind}-category`}>Category</label>
            <input
              id={`${kind}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${kind}-body`}>Body</label>
            <input id={`${kind}-body`} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Save draft
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
