import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Banner = {
  id: string;
  campaignName: string;
  title: string;
  placement: string;
  priority: number;
  targetKind: string;
  targetRef: string;
  lifecycle: string;
};

export function BannersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [campaignName, setCampaignName] = useState('');
  const [title, setTitle] = useState('');

  const list = useQuery({
    queryKey: ['banners'],
    queryFn: () => apiFetch<Banner[]>('/admin/banners'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/banners', {
        method: 'POST',
        body: JSON.stringify({
          campaignName,
          title,
          placement: 'hero',
          priority: 50,
          targetKind: 'section',
          targetRef: 'computer-courses',
          ctaLabel: 'Open',
          altText: title,
        }),
      }),
    onSuccess: () => {
      setCampaignName('');
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['banners'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/banners/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  });

  const pause = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/banners/${id}/pause`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['banners'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Home banners</h1>
          <p>Schedule and publish learner home placements</p>
        </div>
      </div>

      {hasPermission('banners.manage') ? (
        <form
          className="inline-form panel padded"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="banner-campaign">Campaign name</label>
            <input
              id="banner-campaign"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="banner-title">Title</label>
            <input
              id="banner-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
        emptyTitle="No banners"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Title</th>
                <th>Placement</th>
                <th>Priority</th>
                <th>Target</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((banner) => (
                <tr key={banner.id}>
                  <td>{banner.campaignName}</td>
                  <td>{banner.title}</td>
                  <td>{banner.placement}</td>
                  <td>{banner.priority}</td>
                  <td>
                    {banner.targetKind}:{banner.targetRef}
                  </td>
                  <td>
                    <StatusPill value={banner.lifecycle} />
                  </td>
                  <td className="action-row">
                    {banner.lifecycle === 'published' ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => pause.mutate(banner.id)}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => publish.mutate(banner.id)}
                      >
                        Publish
                      </button>
                    )}
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
