import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

type LegalPage = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  summary: string | null;
  body: string;
  version: number;
  effectiveAt: string | null;
  lifecycle: string;
};

const emptyForm = {
  slug: '',
  title: '',
  summary: '',
  body: '',
  effectiveAt: '',
};

function formatDay(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dayInput(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function LegalPagesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LegalPage | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [slugFilter, setSlugFilter] = useState('');

  const list = useQuery({
    queryKey: ['legal-pages'],
    queryFn: () => apiFetch<LegalPage[]>('/admin/legal'),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        summary: form.summary,
        body: form.body,
        ...(form.effectiveAt ? { effectiveAt: form.effectiveAt } : {}),
      };
      if (editing) {
        return apiFetch(`/admin/legal/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      return apiFetch('/admin/legal', {
        method: 'POST',
        body: JSON.stringify({
          slug: form.slug.trim(),
          ...payload,
        }),
      });
    },
    onSuccess: () => {
      setDrawerOpen(false);
      setEditing(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
      queryClient.invalidateQueries({ queryKey: ['public-legal'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/legal/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-pages'] });
      queryClient.invalidateQueries({ queryKey: ['public-legal'] });
    },
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (row) => `${row.title} ${row.slug} ${row.summary ?? ''}`,
    );
    next = filterWhen(next, lifecycle, (row, value) => row.lifecycle === value);
    next = filterWhen(next, slugFilter, (row, value) => row.slug === value);
    return next;
  }, [rows, search, lifecycle, slugFilter]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((row) => row.lifecycle)),
    [rows],
  );
  const slugOptions = useMemo(
    () => distinctOptions(rows.map((row) => row.slug)),
    [rows],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    save.reset();
    setDrawerOpen(true);
  }

  function openEdit(row: LegalPage) {
    setEditing(row);
    setForm({
      slug: row.slug,
      title: row.title,
      summary: row.summary ?? '',
      body: row.body,
      effectiveAt: dayInput(row.effectiveAt),
    });
    save.reset();
    setDrawerOpen(true);
  }

  const canCreate = hasPermission('content.create');
  const canEdit = hasPermission('content.edit');
  const canPublish = hasPermission('content.publish');
  const publishedEdit = editing && editing.lifecycle === 'published';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Legal pages</h1>
          <p>
            Privacy, terms, refunds, and the other notices the public and the learner app read.
            The live copy is the latest published version.
          </p>
        </div>
        {canCreate ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={openCreate}>
              New page
            </button>
          </PageHeaderActions>
        ) : null}
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No legal pages yet"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title or slug…',
          }}
          selects={[
            {
              id: 'slug',
              label: 'Page',
              value: slugFilter,
              onChange: setSlugFilter,
              options: slugOptions,
            },
            {
              id: 'lifecycle',
              label: 'State',
              value: lifecycle,
              onChange: setLifecycle,
              options: lifecycleOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setSlugFilter('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Version</th>
                <th>Effective</th>
                <th>State</th>
                <th></th>
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
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.title}
                      {row.summary ? <p className="muted">{row.summary}</p> : null}
                    </td>
                    <td>{row.slug}</td>
                    <td>{row.version}</td>
                    <td>{formatDay(row.effectiveAt)}</td>
                    <td>
                      <StatusPill value={row.lifecycle} />
                    </td>
                    <td>
                      <div className="table-actions">
                      <Link className="btn btn-ghost" to={`/policies/${row.slug}`}>
                        View
                      </Link>
                      {canEdit ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canPublish && row.lifecycle !== 'published' ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => publish.mutate(row.id)}
                          disabled={publish.isPending}
                        >
                          Publish
                        </button>
                      ) : null}
                      </div>
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
        title={editing ? `Edit ${editing.title}` : 'New legal page'}
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {publishedEdit ? (
            <p className="muted">
              This version is public. Saving writes a draft and leaves the live page unchanged until
              that draft is published.
            </p>
          ) : null}
          {editing ? (
            <p className="muted">
              Public address: /policies/{editing.slug} · API /api/legal/{editing.slug}
            </p>
          ) : (
            <div className="field">
              <label htmlFor="legal-slug">Slug</label>
              <input
                id="legal-slug"
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: event.target.value }))
                }
                placeholder="privacy"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="legal-title">Title</label>
            <input
              id="legal-title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              required
            />
          </div>
          <div className="field">
            <label htmlFor="legal-summary">Summary</label>
            <input
              id="legal-summary"
              value={form.summary}
              onChange={(event) =>
                setForm((current) => ({ ...current, summary: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="legal-effective">Effective date</label>
            <input
              id="legal-effective"
              type="date"
              value={form.effectiveAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, effectiveAt: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="legal-body">Body</label>
            <textarea
              id="legal-body"
              value={form.body}
              onChange={(event) =>
                setForm((current) => ({ ...current, body: event.target.value }))
              }
              required
            />
          </div>
          {save.error instanceof Error ? <p className="error">{save.error.message}</p> : null}
          <button
            className="btn"
            type="submit"
            disabled={
              save.isPending ||
              (Boolean(editing) && !canEdit) ||
              (!editing && !canCreate)
            }
          >
            {save.isPending ? 'Saving…' : 'Save draft'}
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
