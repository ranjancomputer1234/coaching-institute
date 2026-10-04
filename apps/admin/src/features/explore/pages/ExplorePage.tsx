import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

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
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');

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

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Explore sections</h1>
          <p>
            Rename and reorder without breaking stable IDs or deep links
          </p>
        </div>
      </div>

      {hasPermission('explore.manage') ? (
        <form
          className="inline-form panel padded"
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
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && (list.data?.length ?? 0) === 0}
        emptyTitle="No Explore sections"
      >
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
              {(list.data ?? []).map((section) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
