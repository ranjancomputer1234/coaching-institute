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
  description?: string | null;
};

type DrawerMode = 'create' | 'view' | 'edit';

const CATEGORIES = [
  { value: 'learn', label: 'Learn' },
  { value: 'prepare', label: 'Prepare' },
  { value: 'discover', label: 'Discover' },
];

const TARGETS = [
  { kind: 'catalog', ref: 'course,all', label: 'Courses (all)' },
  { kind: 'catalog', ref: 'course,free', label: 'Courses (free)' },
  { kind: 'catalog', ref: 'course,paid', label: 'Courses (paid)' },
  { kind: 'catalog', ref: 'exam', label: 'Exams' },
  { kind: 'catalog', ref: 'news', label: 'News' },
  { kind: 'catalog', ref: 'topic', label: 'Awareness' },
  { kind: 'catalog', ref: 'fact', label: 'Facts' },
  { kind: 'catalog', ref: 'interview', label: 'Interview' },
];

function targetKey(kind: string, ref: string) {
  return `${kind}|${ref}`;
}

function splitTarget(value: string) {
  const index = value.indexOf('|');
  if (index < 0) return { targetKind: value, targetRef: '' };
  return {
    targetKind: value.slice(0, index),
    targetRef: value.slice(index + 1),
  };
}

export function ExplorePage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('explore.manage');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>('create');
  const [editing, setEditing] = useState<ExploreSection | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [formCategory, setFormCategory] = useState('learn');
  const [target, setTarget] = useState(targetKey('catalog', 'course,all'));
  const [homeVisible, setHomeVisible] = useState(true);
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const list = useQuery({
    queryKey: ['explore'],
    queryFn: () => apiFetch<ExploreSection[]>('/admin/explore-sections'),
  });

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setSlug('');
    setFormCategory('learn');
    setTarget(targetKey('catalog', 'course,all'));
    setHomeVisible(true);
    setDescription('');
  };

  const fillForm = (section: ExploreSection) => {
    setEditing(section);
    setTitle(section.title);
    setSlug(section.slug);
    setFormCategory(section.category || 'learn');
    setTarget(targetKey(section.targetKind, section.targetRef));
    setHomeVisible(section.homeVisible);
    setDescription(section.description ?? '');
  };

  const openCreate = () => {
    resetForm();
    setMode('create');
    setDrawerOpen(true);
  };

  const openView = (section: ExploreSection) => {
    fillForm(section);
    setMode('view');
    setDrawerOpen(true);
  };

  const openEdit = (section: ExploreSection) => {
    fillForm(section);
    setMode('edit');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const save = useMutation({
    mutationFn: () => {
      const parsed = splitTarget(target);
      if (mode === 'edit' && editing) {
        return apiFetch(`/admin/explore-sections/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            description: description.trim() || undefined,
            category: formCategory,
            targetKind: parsed.targetKind,
            targetRef: parsed.targetRef,
            homeVisible,
          }),
        });
      }
      return apiFetch('/admin/explore-sections', {
        method: 'POST',
        body: JSON.stringify({
          title,
          slug,
          category: formCategory,
          targetKind: parsed.targetKind,
          targetRef: parsed.targetRef,
          homeVisible,
          description: description.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ['explore'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/explore-sections/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['explore'] }),
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch('/admin/explore-sections/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['explore'] }),
  });

  const rows = list.data ?? [];
  const moveSection = (sectionId: string, direction: -1 | 1) => {
    const ordered = [...rows].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
    );
    const index = ordered.findIndex((row) => row.id === sectionId);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= ordered.length) return;
    const next = [...ordered];
    const temp = next[index]!;
    next[index] = next[swapWith]!;
    next[swapWith] = temp;
    reorder.mutate(next.map((row) => row.id));
  };
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (s) => `${s.title} ${s.slug}`);
    next = filterWhen(next, lifecycle, (s, v) => s.lifecycle === v);
    next = filterWhen(next, categoryFilter, (s, v) => s.category === v);
    return next;
  }, [rows, search, lifecycle, categoryFilter]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((s) => s.lifecycle)),
    [rows],
  );
  const categoryOptions = useMemo(
    () => distinctOptions(rows.map((s) => s.category)),
    [rows],
  );

  const readOnly = mode === 'view';
  const drawerTitle =
    mode === 'view'
      ? 'View explore section'
      : mode === 'edit'
        ? 'Edit explore section'
        : 'Create explore section';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Explore sections</h1>
          <p>Rename and reorder without breaking stable IDs or deep links</p>
        </div>
        {canManage ? (
          <PageHeaderActions>
            <button type="button" className="btn" onClick={openCreate}>
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
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: categoryOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setCategoryFilter('');
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
                    <td>
                      <div className="action-row">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={reorder.isPending}
                          onClick={() => moveSection(section.id, -1)}
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <span>{section.sortOrder}</span>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={reorder.isPending}
                          onClick={() => moveSection(section.id, 1)}
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </td>
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
                        onClick={() => openView(section)}
                      >
                        View
                      </button>
                      {canManage ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openEdit(section)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {canManage && section.lifecycle !== 'published' ? (
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

      <ContentDrawer open={drawerOpen} onClose={closeDrawer} title={drawerTitle} size="full">
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (readOnly) return;
            save.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="explore-title">Title</label>
            <input
              id="explore-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          {mode === 'create' ? (
            <div className="field">
              <label htmlFor="explore-slug">Slug (stable)</label>
              <input
                id="explore-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="field">
              <label>Slug</label>
              <p className="muted">{slug}</p>
            </div>
          )}
          <div className="field">
            <label htmlFor="explore-category">Category</label>
            <select
              id="explore-category"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              disabled={readOnly}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="explore-target">Opens</label>
            <select
              id="explore-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={readOnly}
            >
              {TARGETS.map((item) => (
                <option key={targetKey(item.kind, item.ref)} value={targetKey(item.kind, item.ref)}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="explore-description">Description</label>
            <input
              id="explore-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={homeVisible}
                onChange={(e) => setHomeVisible(e.target.checked)}
                disabled={readOnly}
              />{' '}
              Show on home
            </label>
          </div>
          {mode === 'view' && canManage ? (
            <button type="button" className="btn" onClick={() => setMode('edit')}>
              Edit section
            </button>
          ) : null}
          {!readOnly ? (
            <button type="submit" className="btn" disabled={save.isPending}>
              {mode === 'edit' ? 'Save changes' : 'Create draft'}
            </button>
          ) : null}
          {save.error instanceof Error ? (
            <p className="error">{save.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
