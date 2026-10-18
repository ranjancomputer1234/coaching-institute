import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { filterBySearch } from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type SettingsResponse = {
  items: Array<{ key: string; value: string }>;
  providers: Record<string, boolean>;
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsResponse>('/admin/settings'),
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch('/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      }),
    onSuccess: () => {
      setKey('');
      setValue('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const data = settings.data;
  const items = data?.items ?? [];
  const filteredItems = useMemo(
    () => filterBySearch(items, search, (i) => `${i.key} ${i.value}`),
    [items, search],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Institute settings and which external providers are actually configured</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Save setting
          </button>
        </PageHeaderActions>
      </div>
      <PageState
        loading={settings.isLoading}
        error={settings.error instanceof Error ? settings.error : null}
        empty={false}
      >
        {data ? (
          <>
            <div className="metric-grid">
              {Object.entries(data.providers).map(([name, ready]) => (
                <article className="metric-card" key={name}>
                  <h2>{name}</h2>
                  <StatusPill value={ready ? 'configured' : 'not_configured'} />
                </article>
              ))}
            </div>
            <TableFilterBar
              search={{
                value: search,
                onChange: setSearch,
                placeholder: 'Search settings keys…',
              }}
              onReset={() => setSearch('')}
            />
            <div className="panel" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="muted">
                        No rows match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.key}>
                        <td>{item.key}</td>
                        <td>{item.value}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </PageState>

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Save setting"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="setting-key">Key</label>
            <input
              id="setting-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="setting-value">Value</label>
            <input
              id="setting-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={save.isPending}>
            Save setting
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
