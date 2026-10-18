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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [placement, setPlacement] = useState('');

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
      setDrawerOpen(false);
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

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (b) => `${b.campaignName} ${b.title}`);
    next = filterWhen(next, lifecycle, (b, v) => b.lifecycle === v);
    next = filterWhen(next, placement, (b, v) => b.placement === v);
    return next;
  }, [rows, search, lifecycle, placement]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((b) => b.lifecycle)),
    [rows],
  );
  const placementOptions = useMemo(
    () => distinctOptions(rows.map((b) => b.placement)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Home banners</h1>
          <p>Schedule and publish learner home placements</p>
        </div>
        {hasPermission('banners.manage') ? (
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
        emptyTitle="No banners"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search campaign or title…',
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
              id: 'placement',
              label: 'Placement',
              value: placement,
              onChange: setPlacement,
              options: placementOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setPlacement('');
          }}
        />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((banner) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create banner draft"
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
      </ContentDrawer>
    </section>
  );
}
