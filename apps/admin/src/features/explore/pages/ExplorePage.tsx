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

type ExploreSection = {
  id: string;
  slug: string;
  title: string;
  category: string;
  targetKind: string;
  targetRef: string;
  sortOrder: number;
  lifecycle: string;
  homeVisible: boolean;
};

export function ExplorePage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [category, setCategory] = useState('');

  const list = useQuery({
    queryKey: ['explore'],
    queryFn: () => apiFetch<ExploreSection[]>('/admin/explore-sections'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/explore-sections', {
        method: 'POST',
        body: JSON.stringify({
          title,
          slug,
          category: 'learn',
          targetKind: 'catalog',
          targetRef: 'course,all',
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setSlug('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['explore'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/explore-sections/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['explore'] }),
  });

  const rename = useMutation({
    mutationFn: ({ id, nextTitle }: { id: string; nextTitle: string }) =>
      apiFetch(`/admin/explore-sections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: nextTitle }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['explore'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (s) => `${s.title} ${s.slug}`);
    next = filterWhen(next, lifecycle, (s, v) => s.lifecycle === v);
    next = filterWhen(next, category, (s, v) => s.category === v);
    return next;
  }, [rows, search, lifecycle, category]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((s) => s.lifecycle)),
    [rows],
  );
  const categoryOptions = useMemo(
    () => distinctOptions(rows.map((s) => s.category)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Explore sections</h1>
          <p>Rename and reorder without breaking stable IDs or deep links</p>
        </div>
        {hasPermission('explore.manage') ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              Create draft
            </button>
          </PageHeaderActions>
        ) : null}
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No Explore sections"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title or slug…',
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
              value: category,
              onChange: setCategory,
              options: categoryOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setCategory('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Title</th>
                <th>Slug</th>
                <th>Target</th>
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
                filtered.map((section) => (
                  <tr key={section.id}>
                    <td>{section.sortOrder}</td>
                    <td>{section.title}</td>
                    <td className="muted">{section.slug}</td>
                    <td>
                      {section.targetKind}:{section.targetRef}
                    </td>
                    <td>
                      <StatusPill value={section.lifecycle} />
                    </td>
                    <td className="action-row">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          const next = prompt('New display title', section.title);
                          if (next && next !== section.title) {
                            rename.mutate({ id: section.id, nextTitle: next });
                          }
                        }}
                      >
                        Rename
                      </button>
                      {section.lifecycle !== 'published' ? (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => publish.mutate(section.id)}
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
        title="Create explore section"
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
            <label htmlFor="explore-title">Title</label>
            <input
              id="explore-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="explore-slug">Slug (stable)</label>
            <input
              id="explore-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn">
            Create draft
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
