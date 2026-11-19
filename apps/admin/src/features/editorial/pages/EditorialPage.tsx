import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { confirmDelete } from '../../../shared/lib/confirmDelete';
import { usePersistedViewMode } from '../../../shared/lib/usePersistedViewMode';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { LayoutViewToggle } from '../../../shared/ui/LayoutViewToggle';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Kind = 'news' | 'awareness' | 'fact' | 'interview';

type DrawerMode = 'create' | 'view' | 'edit';

type Category = {
  id: string;
  title: string;
  summary: string | null;
  pricing: string;
  lifecycle: string;
  iconKey: string | null;
};

type Item = {
  id: string;
  title: string;
  category: string | null;
  categoryId: string | null;
  lifecycle: string;
  summary: string | null;
  pricing: string;
  featured: boolean;
  // Extended fields returned by list
  body?: string | null;
  byline?: string | null;
  readingMinutes?: number | null;
  tagsJson?: string | null;
  highlightsJson?: string | null;
  imageUrl?: string | null;
  explanation?: string | null;
  quizId?: string | null;
  schema?: string | null;
  summaryChipsJson?: string | null;
  entriesJson?: string | null;
  prompt?: string | null;
  modelAnswer?: string | null;
  iconKey?: string | null;
};

const INTERVIEW_PRESETS = [
  { id: 'int-hr', title: 'HR questions', iconKey: 'users' },
  { id: 'int-tech', title: 'Technical', iconKey: 'code' },
  { id: 'int-gd', title: 'Group discussion', iconKey: 'users' },
  { id: 'int-apt', title: 'Aptitude', iconKey: 'target' },
  { id: 'int-mock', title: 'Mock interview', iconKey: 'mic' },
  { id: 'int-resume', title: 'Resume', iconKey: 'file' },
];

function linesOf(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function csv(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function entryId(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `entry-${slug || 'item'}`;
}

function awarenessEntries(text: string) {
  return linesOf(text).map((line) => {
    const [label, ...rest] = line.split('|');
    const name = label.trim();
    const value = rest.join('|').trim() || name;
    return { id: entryId(name), label: name, value };
  });
}

/** Parse JSON string array → comma-separated string */
function jsonArrayToCsv(json?: string | null): string {
  try {
    const parsed = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return '';
  }
}

/** Parse JSON string array → newline-separated string */
function jsonArrayToLines(json?: string | null): string {
  try {
    const parsed = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.join('\n') : '';
  } catch {
    return '';
  }
}

/** Parse entriesJson array → "label|value" lines */
function entriesJsonToLines(json?: string | null): string {
  try {
    const parsed = JSON.parse(json ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return '';
    return parsed
      .map((e: unknown) => {
        if (typeof e === 'object' && e !== null) {
          const entry = e as { label?: unknown; value?: unknown };
          const lbl = String(entry.label ?? '');
          const val = String(entry.value ?? '');
          return lbl === val ? lbl : `${lbl}|${val}`;
        }
        return String(e);
      })
      .join('\n');
  } catch {
    return '';
  }
}

export function EditorialPage({
  kind,
  title,
  summary,
}: {
  kind: Kind;
  title: string;
  summary: string;
}) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [itemOpen, setItemOpen] = useState(false);
  const [itemMode, setItemMode] = useState<DrawerMode>('create');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryMode, setCategoryMode] = useState<DrawerMode>('create');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedViewMode(`admin.editorial.${kind}.view`);

  const [itemTitle, setItemTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [byline, setByline] = useState('');
  const [readingMinutes, setReadingMinutes] = useState('3');
  const [tags, setTags] = useState('');
  const [highlights, setHighlights] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [featured, setFeatured] = useState(false);
  const [pricing, setPricing] = useState('free');
  const [explanation, setExplanation] = useState('');
  const [quizId, setQuizId] = useState('');
  const [schema, setSchema] = useState('pairs');
  const [chips, setChips] = useState('');
  const [entries, setEntries] = useState('');
  const [prompt, setPrompt] = useState('');
  const [modelAnswer, setModelAnswer] = useState('');
  const [iconKey, setIconKey] = useState(kind === 'awareness' ? 'book' : '');

  const [catTitle, setCatTitle] = useState('');
  const [catSummary, setCatSummary] = useState('');
  const [catPricing, setCatPricing] = useState('free');
  const [catIcon, setCatIcon] = useState(kind === 'fact' ? 'bulb' : kind === 'news' ? 'news' : 'users');
  const [catPreset, setCatPreset] = useState('');

  const list = useQuery({
    queryKey: ['editorial', kind],
    queryFn: () => apiFetch<Item[]>(`/admin/editorial?kind=${kind}`),
  });
  const categories = useQuery({
    queryKey: ['content-categories', kind],
    queryFn: () => apiFetch<Category[]>(`/admin/content-categories?kind=${kind}`),
    enabled: kind !== 'awareness',
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['editorial', kind] });
    queryClient.invalidateQueries({ queryKey: ['content-categories', kind] });
  };

  // ── Item form helpers ──────────────────────────────────────────────────────

  const resetItemForm = () => {
    setEditingItem(null);
    setItemTitle('');
    setCategoryId('');
    setExcerpt('');
    setBody('');
    setByline('');
    setReadingMinutes('3');
    setTags('');
    setHighlights('');
    setImageUrl('');
    setFeatured(false);
    setPricing('free');
    setExplanation('');
    setQuizId('');
    setSchema('pairs');
    setChips('');
    setEntries('');
    setPrompt('');
    setModelAnswer('');
    setIconKey(kind === 'awareness' ? 'book' : '');
  };

  const fillItemForm = (item: Item) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setCategoryId(item.categoryId ?? '');
    setExcerpt(item.summary ?? '');
    setPricing(item.pricing || 'free');
    setFeatured(item.featured);

    if (kind === 'news') {
      setBody(jsonArrayToLines(item.body));
      setByline(item.byline ?? '');
      setReadingMinutes(String(item.readingMinutes ?? 3));
      setImageUrl(item.imageUrl ?? '');
      setTags(jsonArrayToCsv(item.tagsJson));
      setHighlights(jsonArrayToLines(item.highlightsJson));
    }
    if (kind === 'awareness') {
      setSchema(item.schema ?? 'pairs');
      setIconKey(item.iconKey ?? 'book');
      setChips(jsonArrayToCsv(item.summaryChipsJson));
      setEntries(entriesJsonToLines(item.entriesJson));
    }
    if (kind === 'fact') {
      setExplanation(item.explanation ?? '');
      setQuizId(item.quizId ?? '');
    }
    if (kind === 'interview') {
      setPrompt(item.prompt ?? '');
      setModelAnswer(item.modelAnswer ?? '');
    }
  };

  const openItemCreate = () => {
    resetItemForm();
    setItemMode('create');
    setFormError(null);
    setItemOpen(true);
  };

  const openItemView = (item: Item) => {
    fillItemForm(item);
    setItemMode('view');
    setFormError(null);
    setItemOpen(true);
  };

  const openItemEdit = (item: Item) => {
    fillItemForm(item);
    setItemMode('edit');
    setFormError(null);
    setItemOpen(true);
  };

  const closeItemDrawer = () => {
    setItemOpen(false);
    setItemMode('create');
    setEditingItem(null);
  };

  // ── Category form helpers ──────────────────────────────────────────────────

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCatTitle('');
    setCatSummary('');
    setCatPricing('free');
    setCatIcon(kind === 'fact' ? 'bulb' : kind === 'news' ? 'news' : 'users');
    setCatPreset('');
  };

  const fillCategoryForm = (cat: Category) => {
    setEditingCategory(cat);
    setCatTitle(cat.title);
    setCatSummary(cat.summary ?? '');
    setCatPricing(cat.pricing || 'free');
    setCatIcon(cat.iconKey ?? '');
    setCatPreset('');
  };

  const openCategoryCreate = () => {
    resetCategoryForm();
    setCategoryMode('create');
    setFormError(null);
    setCategoryOpen(true);
  };

  const openCategoryView = (cat: Category) => {
    fillCategoryForm(cat);
    setCategoryMode('view');
    setFormError(null);
    setCategoryOpen(true);
  };

  const openCategoryEdit = (cat: Category) => {
    fillCategoryForm(cat);
    setCategoryMode('edit');
    setFormError(null);
    setCategoryOpen(true);
  };

  const closeCategoryDrawer = () => {
    setCategoryOpen(false);
    setCategoryMode('create');
    setEditingCategory(null);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

  const buildItemPayload = (includeKind: boolean) => {
    const selected = (categories.data ?? []).find((row) => row.id === categoryId);
    const sentence = itemTitle.trim();
    const payload: Record<string, unknown> = {
      pricing,
      featured,
    };
    if (includeKind) payload.kind = kind;
    payload.title = kind === 'interview' ? prompt.trim() || sentence : sentence;

    if (kind !== 'awareness') {
      if (categoryId) {
        payload.categoryId = categoryId;
        payload.category = selected?.title;
      }
    }
    if (kind === 'news') {
      payload.summary = excerpt.trim() || undefined;
      payload.body = JSON.stringify(linesOf(body));
      payload.byline = byline.trim() || undefined;
      payload.readingMinutes = Number(readingMinutes) || 3;
      payload.tagsJson = JSON.stringify(csv(tags));
      payload.highlightsJson = JSON.stringify(linesOf(highlights));
      payload.imageUrl = imageUrl.trim() || undefined;
    }
    if (kind === 'awareness') {
      payload.summary = excerpt.trim() || undefined;
      payload.iconKey = iconKey.trim() || 'book';
      payload.schema = schema;
      payload.summaryChipsJson = JSON.stringify(csv(chips));
      payload.entriesJson = JSON.stringify(awarenessEntries(entries));
    }
    if (kind === 'fact') {
      payload.summary = sentence;
      payload.explanation = explanation.trim() || undefined;
      payload.quizId = quizId.trim() || undefined;
    }
    if (kind === 'interview') {
      payload.prompt = prompt.trim();
      payload.modelAnswer = modelAnswer.trim() || undefined;
    }
    return payload;
  };

  const createItem = useMutation({
    mutationFn: () => {
      if (kind !== 'awareness' && !categoryId) {
        throw new Error('Choose a category. Publish it before learners can see the chip.');
      }
      return apiFetch('/admin/editorial', {
        method: 'POST',
        body: JSON.stringify(buildItemPayload(true)),
      });
    },
    onSuccess: () => {
      closeItemDrawer();
      setFormError(null);
      refresh();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save');
    },
  });

  const updateItem = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/editorial/${editingItem!.id}`, {
        method: 'PATCH',
        body: JSON.stringify(buildItemPayload(false)),
      }),
    onSuccess: () => {
      closeItemDrawer();
      setFormError(null);
      refresh();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save');
    },
  });

  const createCategory = useMutation({
    mutationFn: () => {
      const preset = INTERVIEW_PRESETS.find((row) => row.id === catPreset);
      return apiFetch('/admin/content-categories', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          ...(preset ? { id: preset.id } : {}),
          title: (preset?.title || catTitle).trim(),
          summary: catSummary.trim() || undefined,
          pricing: catPricing,
          iconKey: (preset?.iconKey || catIcon).trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      closeCategoryDrawer();
      setFormError(null);
      refresh();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save the category');
    },
  });

  const updateCategory = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/content-categories/${editingCategory!.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: catTitle.trim(),
          summary: catSummary.trim() || undefined,
          pricing: catPricing,
          iconKey: catIcon.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      closeCategoryDrawer();
      setFormError(null);
      refresh();
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save the category');
    },
  });

  const publishItem = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/editorial/${id}/publish`, { method: 'POST' }),
    onSuccess: refresh,
  });
  const publishCategory = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/content-categories/${id}/publish`, { method: 'POST' }),
    onSuccess: refresh,
  });
  const archiveItem = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/editorial/${id}/archive`, { method: 'POST' }),
    onSuccess: refresh,
  });
  const archiveCategory = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/content-categories/${id}/archive`, { method: 'POST' }),
    onSuccess: refresh,
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (row) => `${row.title} ${row.category ?? ''} ${row.summary ?? ''}`);
    next = filterWhen(next, lifecycle, (row, value) => row.lifecycle === value);
    next = filterWhen(next, catFilter, (row, value) => (row.category ?? '') === value);
    return next;
  }, [rows, search, lifecycle, catFilter]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((row) => row.lifecycle)),
    [rows],
  );
  const categoryOptions = useMemo(
    () => distinctOptions(rows.map((row) => row.category ?? '')),
    [rows],
  );
  const canCreate = hasPermission('content.create');
  const canEdit = hasPermission('content.edit');
  const canPublish = hasPermission('content.publish');

  const itemReadOnly = itemMode === 'view';
  const catReadOnly = categoryMode === 'view';

  const itemDrawerTitle =
    itemMode === 'view'
      ? `View ${kind === 'news' ? 'article' : kind === 'fact' ? 'fact' : kind === 'interview' ? 'question' : 'topic'}`
      : itemMode === 'edit'
        ? `Edit ${kind === 'news' ? 'article' : kind === 'fact' ? 'fact' : kind === 'interview' ? 'question' : 'topic'}`
        : kind === 'news'
          ? 'Add article'
          : kind === 'fact'
            ? 'Add fact'
            : kind === 'interview'
              ? 'Add question'
              : 'Add topic';

  const catDrawerTitle =
    categoryMode === 'view'
      ? 'View category'
      : categoryMode === 'edit'
        ? 'Edit category'
        : 'Add category';

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{summary}</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          {canCreate && kind !== 'awareness' ? (
            <button type="button" className="btn btn-ghost" onClick={openCategoryCreate}>
              Add category
            </button>
          ) : null}
          {canCreate ? (
            <button type="button" className="btn" onClick={openItemCreate}>
              {kind === 'news'
                ? 'Add article'
                : kind === 'fact'
                  ? 'Add fact'
                  : kind === 'interview'
                    ? 'Add question'
                    : 'Add topic'}
            </button>
          ) : null}
        </PageHeaderActions>
      </div>

      {kind !== 'awareness' ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Id</th>
                <th>Pricing</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(categories.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No categories yet. Chips stay empty until a category is published.
                  </td>
                </tr>
              ) : (
                (categories.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.id}</td>
                    <td>{row.pricing}</td>
                    <td>
                      <StatusPill value={row.lifecycle} />
                    </td>
                    <td className="action-row">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => openCategoryView(row)}
                      >
                        View
                      </button>
                      {canEdit ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => openCategoryEdit(row)}
                        >
                          Edit
                        </button>
                      ) : null}
                      {row.lifecycle !== 'published' && canPublish ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => publishCategory.mutate(row.id)}
                        >
                          Publish
                        </button>
                      ) : null}
                      {canEdit && row.lifecycle !== 'archived' ? (
                        <button
                          className="btn btn-danger-ghost"
                          type="button"
                          onClick={() => { if (confirmDelete(row.title)) archiveCategory.mutate(row.id); }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="Nothing here yet"
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
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filtered.length === 0 ? (
              <p className="muted">No rows match filters.</p>
            ) : (
              filtered.map((row) => (
                <div key={row.id} className="entity-card">
                  {row.imageUrl ? (
                    <img className="entity-card-cover" src={row.imageUrl} alt="" />
                  ) : (
                    <div className="entity-card-cover-empty" />
                  )}
                  <div className="entity-card-meta">
                    <strong>{row.title.length > 60 ? `${row.title.slice(0, 60)}…` : row.title}</strong>
                    <StatusPill value={row.lifecycle} />
                    <span className="muted small">{row.category ?? '—'} · {row.pricing}</span>
                  </div>
                  <div className="entity-card-actions action-row">
                    <button className="btn btn-ghost" type="button" onClick={() => openItemView(row)}>View</button>
                    {canEdit ? <button className="btn btn-ghost" type="button" onClick={() => openItemEdit(row)}>Edit</button> : null}
                    {row.lifecycle !== 'published' && canPublish ? (
                      <button className="btn btn-ghost" type="button" onClick={() => publishItem.mutate(row.id)}>Publish</button>
                    ) : null}
                    {canEdit && row.lifecycle !== 'archived' ? (
                      <button
                        className="btn btn-danger-ghost"
                        type="button"
                        onClick={() => { if (confirmDelete(row.title)) archiveItem.mutate(row.id); }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : viewMode === 'compact' ? (
          <div className="panel">
            <ul className="entity-compact-list">
              {filtered.length === 0 ? (
                <li className="muted">No rows match filters.</li>
              ) : (
                filtered.map((row) => (
                  <li key={row.id}>
                    <div className="entity-compact-main">
                      <strong>{row.title.length > 70 ? `${row.title.slice(0, 70)}…` : row.title}</strong>
                      <span className="muted small">{row.category ?? '—'} · {row.pricing}</span>
                      <StatusPill value={row.lifecycle} />
                    </div>
                    <div className="entity-card-actions action-row">
                      <button className="btn btn-ghost" type="button" onClick={() => openItemView(row)}>View</button>
                      {canEdit ? <button className="btn btn-ghost" type="button" onClick={() => openItemEdit(row)}>Edit</button> : null}
                      {row.lifecycle !== 'published' && canPublish ? (
                        <button className="btn btn-ghost" type="button" onClick={() => publishItem.mutate(row.id)}>Publish</button>
                      ) : null}
                      {canEdit && row.lifecycle !== 'archived' ? (
                        <button
                          className="btn btn-danger-ghost"
                          type="button"
                          onClick={() => { if (confirmDelete(row.title)) archiveItem.mutate(row.id); }}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Pricing</th>
                  <th>State</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      No rows match filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.category ?? '—'}</td>
                      <td>{row.pricing}</td>
                      <td>
                        <StatusPill value={row.lifecycle} />
                      </td>
                      <td className="action-row">
                        <button className="btn btn-ghost" type="button" onClick={() => openItemView(row)}>View</button>
                        {canEdit ? (
                          <button className="btn btn-ghost" type="button" onClick={() => openItemEdit(row)}>Edit</button>
                        ) : null}
                        {row.lifecycle !== 'published' && canPublish ? (
                          <button className="btn btn-ghost" type="button" onClick={() => publishItem.mutate(row.id)}>Publish</button>
                        ) : null}
                        {canEdit && row.lifecycle !== 'archived' ? (
                          <button
                            className="btn btn-danger-ghost"
                            type="button"
                            onClick={() => { if (confirmDelete(row.title)) archiveItem.mutate(row.id); }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </PageState>

      {/* ── Category drawer ───────────────────────────────────────────────── */}
      <ContentDrawer
        open={categoryOpen}
        onClose={closeCategoryDrawer}
        title={catDrawerTitle}
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (catReadOnly) return;
            setFormError(null);
            if (categoryMode === 'edit') updateCategory.mutate();
            else createCategory.mutate();
          }}
        >
          {kind === 'interview' && categoryMode === 'create' ? (
            <div className="field">
              <label htmlFor="cat-preset">Topic</label>
              <select
                id="cat-preset"
                value={catPreset}
                onChange={(event) => {
                  setCatPreset(event.target.value);
                  const preset = INTERVIEW_PRESETS.find((row) => row.id === event.target.value);
                  if (preset) setCatTitle(preset.title);
                }}
              >
                <option value="">Custom title</option>
                {INTERVIEW_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title} ({preset.id})
                  </option>
                ))}
              </select>
              <p className="field-hint">These ids match the short labels in the learner app.</p>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="cat-title">Title</label>
            <input
              id="cat-title"
              value={catTitle}
              onChange={(event) => setCatTitle(event.target.value)}
              required
              minLength={2}
              readOnly={catReadOnly}
              disabled={catReadOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="cat-summary">Summary</label>
            <input
              id="cat-summary"
              value={catSummary}
              onChange={(event) => setCatSummary(event.target.value)}
              readOnly={catReadOnly}
              disabled={catReadOnly}
            />
          </div>
          <div className="field">
            <label htmlFor="cat-pricing">Pricing</label>
            <select
              id="cat-pricing"
              value={catPricing}
              onChange={(event) => setCatPricing(event.target.value)}
              disabled={catReadOnly}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cat-icon">Icon name</label>
            <input
              id="cat-icon"
              value={catIcon}
              onChange={(event) => setCatIcon(event.target.value)}
              readOnly={catReadOnly}
              disabled={catReadOnly}
            />
          </div>
          {formError ? <p className="error">{formError}</p> : null}
          {categoryMode === 'view' && canEdit ? (
            <button type="button" className="btn" onClick={() => setCategoryMode('edit')}>
              Edit category
            </button>
          ) : null}
          {!catReadOnly ? (
            <button
              className="btn"
              type="submit"
              disabled={categoryMode === 'edit' ? updateCategory.isPending : createCategory.isPending}
            >
              {categoryMode === 'edit' ? 'Save changes' : 'Save category'}
            </button>
          ) : null}
        </form>
      </ContentDrawer>

      {/* ── Item drawer ───────────────────────────────────────────────────── */}
      <ContentDrawer
        open={itemOpen}
        onClose={closeItemDrawer}
        title={itemDrawerTitle}
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (itemReadOnly) return;
            setFormError(null);
            if (itemMode === 'edit') updateItem.mutate();
            else createItem.mutate();
          }}
        >
          {kind !== 'awareness' ? (
            <div className="field">
              <label htmlFor="item-category">Category</label>
              <select
                id="item-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required={itemMode === 'create'}
                disabled={itemReadOnly}
              >
                <option value="">Choose a category</option>
                {(categories.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} ({row.lifecycle})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {kind !== 'interview' ? (
            <div className="field">
              <label htmlFor="item-title">{kind === 'fact' ? 'Fact' : 'Title'}</label>
              <input
                id="item-title"
                value={itemTitle}
                onChange={(event) => setItemTitle(event.target.value)}
                required={!itemReadOnly}
                minLength={2}
                readOnly={itemReadOnly}
                disabled={itemReadOnly}
              />
            </div>
          ) : null}

          {kind === 'news' ? (
            <>
              <div className="field">
                <label htmlFor="item-excerpt">Excerpt</label>
                <textarea
                  id="item-excerpt"
                  rows={3}
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-body">Article</label>
                <textarea
                  id="item-body"
                  rows={8}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="One paragraph per line"
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-byline">Byline</label>
                <input
                  id="item-byline"
                  value={byline}
                  onChange={(event) => setByline(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-minutes">Reading minutes</label>
                <input
                  id="item-minutes"
                  type="number"
                  min={1}
                  value={readingMinutes}
                  onChange={(event) => setReadingMinutes(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-image">Image link</label>
                <input
                  id="item-image"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://"
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-tags">Tags</label>
                <input
                  id="item-tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="policy, jobs"
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-highlights">Highlights</label>
                <textarea
                  id="item-highlights"
                  rows={3}
                  value={highlights}
                  onChange={(event) => setHighlights(event.target.value)}
                  placeholder="One highlight per line"
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
            </>
          ) : null}

          {kind === 'awareness' ? (
            <>
              <div className="field">
                <label htmlFor="item-summary">Summary</label>
                <input
                  id="item-summary"
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-schema">Layout</label>
                <select
                  id="item-schema"
                  value={schema}
                  onChange={(event) => setSchema(event.target.value)}
                  disabled={itemReadOnly}
                >
                  <option value="pairs">Pairs, such as state and capital</option>
                  <option value="list">List</option>
                  <option value="article">Article</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="item-chips">Summary chips</label>
                <input
                  id="item-chips"
                  value={chips}
                  onChange={(event) => setChips(event.target.value)}
                  placeholder="28 states, 8 union territories"
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-entries">Entries</label>
                <textarea
                  id="item-entries"
                  rows={8}
                  value={entries}
                  onChange={(event) => setEntries(event.target.value)}
                  placeholder={'Bihar | Patna\nJharkhand | Ranchi'}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
                <p className="field-hint">One entry per line. Use Label | Value. The app does not sort these.</p>
              </div>
              <div className="field">
                <label htmlFor="item-icon">Icon name</label>
                <input
                  id="item-icon"
                  value={iconKey}
                  onChange={(event) => setIconKey(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
            </>
          ) : null}

          {kind === 'fact' ? (
            <>
              <div className="field">
                <label htmlFor="item-explanation">Explanation</label>
                <textarea
                  id="item-explanation"
                  rows={4}
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-quiz">Quiz test id</label>
                <input
                  id="item-quiz"
                  value={quizId}
                  onChange={(event) => setQuizId(event.target.value)}
                  placeholder="Leave empty if there is no quiz"
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
                <p className="field-hint">Must be a published test id. A wrong id opens a broken quiz.</p>
              </div>
            </>
          ) : null}

          {kind === 'interview' ? (
            <>
              <div className="field">
                <label htmlFor="item-prompt">Question</label>
                <textarea
                  id="item-prompt"
                  rows={3}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  required={!itemReadOnly}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
              <div className="field">
                <label htmlFor="item-answer">Model answer</label>
                <textarea
                  id="item-answer"
                  rows={5}
                  value={modelAnswer}
                  onChange={(event) => setModelAnswer(event.target.value)}
                  readOnly={itemReadOnly}
                  disabled={itemReadOnly}
                />
              </div>
            </>
          ) : null}

          <div className="field">
            <label htmlFor="item-pricing">Pricing</label>
            <select
              id="item-pricing"
              value={pricing}
              onChange={(event) => setPricing(event.target.value)}
              disabled={itemReadOnly}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {kind === 'news' || kind === 'fact' ? (
            <label className="choice-list">
              <input
                type="checkbox"
                checked={featured}
                onChange={(event) => setFeatured(event.target.checked)}
                disabled={itemReadOnly}
              />
              Featured
            </label>
          ) : null}
          {formError ? <p className="error">{formError}</p> : null}
          {itemMode === 'view' && canEdit ? (
            <button type="button" className="btn" onClick={() => setItemMode('edit')}>
              Edit {kind === 'news' ? 'article' : kind === 'fact' ? 'fact' : kind === 'interview' ? 'question' : 'topic'}
            </button>
          ) : null}
          {!itemReadOnly ? (
            <button
              className="btn"
              type="submit"
              disabled={itemMode === 'edit' ? updateItem.isPending : createItem.isPending}
            >
              {itemMode === 'edit' ? 'Save changes' : 'Save draft'}
            </button>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
