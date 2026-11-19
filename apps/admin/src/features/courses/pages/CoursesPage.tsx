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

type Course = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string | null;
  summary: string | null;
  commercialMode: string;
  lifecycle: string;
  pricePaise: number | null;
  sortOrder: number;
  coverImageUrl: string | null;
  iconUrl: string | null;
  _count?: { lessons: number; enrollments: number };
};

function formatAccess(course: Pick<Course, 'commercialMode' | 'pricePaise'>) {
  if (course.commercialMode !== 'paid') return 'FREE';
  if (!course.pricePaise || course.pricePaise < 100) return 'Paid (set ₹)';
  return `₹${(course.pricePaise / 100).toLocaleString('en-IN')}`;
}

type Lesson = {
  id: string;
  title: string;
  lifecycle: string;
  sortOrder: number;
  isPreview: boolean;
  durationMinutes: number | null;
};

type CourseDetail = Course & {
  lessons: Lesson[];
};

async function uploadCourseImage(file: File): Promise<string> {
  const slot = await apiFetch<{ uploadUrl: string; formFields: Record<string, string> }>(
    '/admin/courses/image-uploads',
    { method: 'POST' },
  );
  const body = new FormData();
  Object.entries(slot.formFields).forEach(([key, value]) => body.append(key, value));
  body.append('file', file);
  const response = await fetch(slot.uploadUrl, { method: 'POST', body });
  const payload = (await response.json()) as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !payload.secure_url) {
    throw new Error(payload.error?.message || 'Image upload failed');
  }
  return payload.secure_url;
}

export function CoursesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [commercialMode, setCommercialMode] = useState('free');
  const [priceRupees, setPriceRupees] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [editing, setEditing] = useState<Course | null>(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lessonMinutes, setLessonMinutes] = useState('');
  const [lessonPreview, setLessonPreview] = useState(false);
  const [lessonCourse, setLessonCourse] = useState<Course | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [manageCourse, setManageCourse] = useState<Course | null>(null);
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [mode, setMode] = useState('');
  const [viewMode, setViewMode] = usePersistedViewMode('admin.courses.view');

  const list = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiFetch<Course[]>('/admin/courses'),
  });

  const courseDetail = useQuery({
    queryKey: ['course', manageCourse?.id],
    enabled: Boolean(manageCourse?.id),
    queryFn: () => apiFetch<CourseDetail>(`/admin/courses/${manageCourse!.id}`),
  });

  const create = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        title,
        slug,
        commercialMode,
        shortTitle: shortTitle.trim() || undefined,
        summary: summary.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
      };
      if (commercialMode === 'paid') {
        const rupees = Number(priceRupees);
        if (!Number.isInteger(rupees) || rupees < 1) {
          throw new Error('Paid courses need a whole-rupee price of at least ₹1');
        }
        body.pricePaise = rupees * 100;
      }
      return apiFetch('/admin/courses', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setTitle('');
      setSlug('');
      setPriceRupees('');
      setCommercialMode('free');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const saveCover = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('Choose a course');
      const body: Record<string, unknown> = {
        shortTitle: shortTitle.trim() || undefined,
        summary: summary.trim() || undefined,
        commercialMode,
        iconUrl: iconUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
      };
      if (commercialMode === 'paid') {
        const rupees = Number(priceRupees);
        if (!Number.isInteger(rupees) || rupees < 1) {
          throw new Error('Paid courses need a whole-rupee price of at least ₹1');
        }
        body.pricePaise = rupees * 100;
      } else {
        body.pricePaise = null;
      }
      return apiFetch(`/admin/courses/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setEditing(null);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : 'Could not save the cover');
    },
  });

  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiFetch('/admin/courses/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  const onCoverFile = async (file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    setUploading(true);
    try {
      setCoverImageUrl(await uploadCourseImage(file));
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Image upload failed. Paste a public https image link instead.',
      );
    } finally {
      setUploading(false);
    }
  };

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/courses/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    },
  });

  const unpublish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/courses/${id}/unpublish`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/courses/${id}/archive`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    },
  });

  const publishLesson = useMutation({
    mutationFn: ({ courseId, lessonId }: { courseId: string; lessonId: string }) =>
      apiFetch(`/admin/courses/${courseId}/lessons/${lessonId}/publish`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    },
  });

  const addLesson = useMutation({
    mutationFn: () => {
      if (!lessonCourse) throw new Error('Choose a course first');
      const description = lessonDescription.trim();
      return apiFetch(`/admin/courses/${lessonCourse.id}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          title: lessonTitle.trim(),
          ...(description ? { description } : {}),
          ...(lessonMinutes.trim() ? { durationMinutes: Number(lessonMinutes) } : {}),
          isPreview: lessonPreview,
        }),
      });
    },
    onSuccess: () => {
      setLessonTitle('');
      setLessonDescription('');
      setLessonCourse(null);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    },
  });

  const rows = list.data ?? [];
  const moveCourse = (courseId: string, direction: -1 | 1) => {
    const ordered = [...rows].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title),
    );
    const index = ordered.findIndex((row) => row.id === courseId);
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
    next = filterBySearch(next, search, (c) => `${c.title} ${c.slug}`);
    next = filterWhen(next, lifecycle, (c, v) => c.lifecycle === v);
    next = filterWhen(next, mode, (c, v) => c.commercialMode === v);
    return next;
  }, [rows, search, lifecycle, mode]);

  const lifecycleOptions = useMemo(
    () => distinctOptions(rows.map((c) => c.lifecycle)),
    [rows],
  );
  const modeOptions = useMemo(
    () => distinctOptions(rows.map((c) => c.commercialMode)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Courses</h1>
          <p>Create, edit, and publish learning courses</p>
        </div>
        <PageHeaderActions>
          <LayoutViewToggle value={viewMode} onChange={setViewMode} />
          {hasPermission('content.create') ? (
            <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
              Create draft
            </button>
          ) : null}
        </PageHeaderActions>
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No courses yet"
        emptyHint="Create a draft course to get started."
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
              label: 'Lifecycle',
              value: lifecycle,
              onChange: setLifecycle,
              options: lifecycleOptions,
            },
            {
              id: 'mode',
              label: 'Mode',
              value: mode,
              onChange: setMode,
              options: modeOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setLifecycle('');
            setMode('');
          }}
        />
        {viewMode === 'grid' ? (
          <div className="entity-grid">
            {filtered.length === 0 ? (
              <p className="muted">No rows match filters.</p>
            ) : (
              filtered.map((course) => (
                <div key={course.id} className="entity-card">
                  {course.coverImageUrl ? (
                    <img className="entity-card-cover" src={course.coverImageUrl} alt="" />
                  ) : (
                    <div className="entity-card-cover-empty" />
                  )}
                  <div className="entity-card-meta">
                    <strong>{course.title}</strong>
                    <StatusPill value={course.lifecycle} />
                    <span className="muted small">{course.slug}</span>
                    <span>{formatAccess(course)}</span>
                    <span className="muted small">{course._count?.lessons ?? 0} lessons</span>
                  </div>
                  <div className="entity-card-actions action-row">
                    {hasPermission('content.edit') ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditing(course);
                          setShortTitle(course.shortTitle ?? '');
                          setSummary(course.summary ?? '');
                          setCommercialMode(course.commercialMode || 'free');
                          setPriceRupees(course.pricePaise ? String(Math.round(course.pricePaise / 100)) : '');
                          setIconUrl(course.iconUrl ?? '');
                          setCoverImageUrl(course.coverImageUrl ?? '');
                          setFormError(null);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                    {hasPermission('content.publish') && course.lifecycle !== 'published' ? (
                      <button type="button" className="btn" onClick={() => publish.mutate(course.id)}>
                        Publish
                      </button>
                    ) : null}
                    {hasPermission('content.archive') && course.lifecycle !== 'archived' ? (
                      <button
                        type="button"
                        className="btn btn-danger-ghost"
                        onClick={() => { if (confirmDelete(course.title)) archive.mutate(course.id); }}
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
                filtered.map((course) => (
                  <li key={course.id}>
                    <div className="entity-compact-main">
                      <strong>{course.title}</strong>
                      <span className="muted small">
                        {course.slug} · {formatAccess(course)} · {course._count?.lessons ?? 0} lessons
                      </span>
                      <StatusPill value={course.lifecycle} />
                    </div>
                    <div className="entity-card-actions action-row">
                      {hasPermission('content.edit') ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setEditing(course);
                            setShortTitle(course.shortTitle ?? '');
                            setSummary(course.summary ?? '');
                            setCommercialMode(course.commercialMode || 'free');
                            setPriceRupees(course.pricePaise ? String(Math.round(course.pricePaise / 100)) : '');
                            setIconUrl(course.iconUrl ?? '');
                            setCoverImageUrl(course.coverImageUrl ?? '');
                            setFormError(null);
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                      {hasPermission('content.publish') && course.lifecycle !== 'published' ? (
                        <button type="button" className="btn" onClick={() => publish.mutate(course.id)}>
                          Publish
                        </button>
                      ) : null}
                      {hasPermission('content.archive') && course.lifecycle !== 'archived' ? (
                        <button
                          type="button"
                          className="btn btn-danger-ghost"
                          onClick={() => { if (confirmDelete(course.title)) archive.mutate(course.id); }}
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
                  <th>Order</th>
                  <th>Cover</th>
                  <th>Title</th>
                  <th>Slug</th>
                  <th>Access</th>
                  <th>Lifecycle</th>
                  <th>Lessons</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      No rows match filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <div className="action-row">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={reorder.isPending}
                            onClick={() => moveCourse(course.id, -1)}
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={reorder.isPending}
                            onClick={() => moveCourse(course.id, 1)}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td>
                        {course.coverImageUrl ? (
                          <img className="banner-thumb" src={course.coverImageUrl} alt="" />
                        ) : (
                          <span className="muted">No cover</span>
                        )}
                      </td>
                      <td>{course.title}</td>
                      <td className="muted">{course.slug}</td>
                      <td>{formatAccess(course)}</td>
                      <td>
                        <StatusPill value={course.lifecycle} />
                      </td>
                      <td>{course._count?.lessons ?? 0}</td>
                      <td className="action-row">
                        {hasPermission('content.edit') ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              setEditing(course);
                              setShortTitle(course.shortTitle ?? '');
                              setSummary(course.summary ?? '');
                              setCommercialMode(course.commercialMode || 'free');
                              setPriceRupees(
                                course.pricePaise
                                  ? String(Math.round(course.pricePaise / 100))
                                  : '',
                              );
                              setIconUrl(course.iconUrl ?? '');
                              setCoverImageUrl(course.coverImageUrl ?? '');
                              setFormError(null);
                            }}
                          >
                            Edit
                          </button>
                        ) : null}
                        {hasPermission('content.edit') ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              addLesson.reset();
                              setLessonTitle('');
                              setLessonDescription('');
                              setLessonCourse(course);
                            }}
                          >
                            Add lesson
                          </button>
                        ) : null}
                        {hasPermission('content.edit') ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setManageCourse(course)}
                          >
                            Lessons
                          </button>
                        ) : null}
                        {hasPermission('content.publish') &&
                        course.lifecycle !== 'published' ? (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => publish.mutate(course.id)}
                          >
                            Publish
                          </button>
                        ) : null}
                        {hasPermission('content.publish') &&
                        course.lifecycle === 'published' ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => unpublish.mutate(course.id)}
                          >
                            Unpublish
                          </button>
                        ) : null}
                        {hasPermission('content.archive') &&
                        course.lifecycle !== 'archived' ? (
                          <button
                            type="button"
                            className="btn btn-danger-ghost"
                            onClick={() => {
                              if (confirmDelete(course.title)) archive.mutate(course.id);
                            }}
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

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create course draft"
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
            <label htmlFor="course-title">Title</label>
            <input
              id="course-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="course-short">Short title</label>
            <input
              id="course-short"
              value={shortTitle}
              onChange={(e) => setShortTitle(e.target.value)}
              placeholder="Shown as a letter when there is no icon"
            />
          </div>
          <div className="field">
            <label htmlFor="course-summary">Summary</label>
            <input id="course-summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="course-pricing">Access</label>
            <select
              id="course-pricing"
              value={commercialMode}
              onChange={(e) => {
                setCommercialMode(e.target.value);
                if (e.target.value !== 'paid') setPriceRupees('');
              }}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {commercialMode === 'paid' ? (
            <div className="field">
              <label htmlFor="course-price">Price (₹)</label>
              <input
                id="course-price"
                type="number"
                min={1}
                step={1}
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value)}
                required
              />
              <p className="field-hint">
                Whole rupees only. Preview:{' '}
                {Number(priceRupees) >= 1
                  ? `₹${Number(priceRupees).toLocaleString('en-IN')}`
                  : '—'}
              </p>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="course-cover">Subject cover image</label>
            <input
              id="course-cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onCoverFile(file);
              }}
            />
            <input
              id="course-cover"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https:// cover for this subject"
            />
            <p className="field-hint">
              This is the large picture on the course screen. Use a different image for each subject.
            </p>
            {coverImageUrl.trim().startsWith('https://') ? (
              <img className="banner-thumb" src={coverImageUrl.trim()} alt="" />
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="course-icon">Icon image link</label>
            <input
              id="course-icon"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="field">
            <label htmlFor="course-slug">Slug (stable)</label>
            <input
              id="course-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn" disabled={create.isPending}>
            Create draft
          </button>
          {formError ? <p className="error">{formError}</p> : null}
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>

      <ContentDrawer
        open={editing !== null}
        onClose={() => {
          if (saveCover.isPending) return;
          setEditing(null);
        }}
        title={editing ? `Edit — ${editing.title}` : 'Edit course'}
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            saveCover.mutate();
          }}
        >
          <p className="field-hint">
            The phone shows this picture at the top of {editing?.title}. Set Free / Paid and a rupee
            price for paid courses.
          </p>
          <div className="field">
            <label htmlFor="edit-access">Access</label>
            <select
              id="edit-access"
              value={commercialMode}
              onChange={(event) => {
                setCommercialMode(event.target.value);
                if (event.target.value !== 'paid') setPriceRupees('');
              }}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {commercialMode === 'paid' ? (
            <div className="field">
              <label htmlFor="edit-price">Price (₹)</label>
              <input
                id="edit-price"
                type="number"
                min={1}
                step={1}
                value={priceRupees}
                onChange={(event) => setPriceRupees(event.target.value)}
                required
              />
              <p className="field-hint">
                Preview:{' '}
                {Number(priceRupees) >= 1
                  ? `₹${Number(priceRupees).toLocaleString('en-IN')}`
                  : '—'}
              </p>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="edit-cover-file">Cover image</label>
            <input
              id="edit-cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                void onCoverFile(file);
              }}
            />
            <input
              id="edit-cover"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              placeholder="https://"
            />
            {coverImageUrl.trim().startsWith('https://') ? (
              <img className="banner-thumb" src={coverImageUrl.trim()} alt="" />
            ) : null}
          </div>
          {formError ? <p className="error">{formError}</p> : null}
          <button className="btn" type="submit" disabled={saveCover.isPending || uploading}>
            {uploading ? 'Uploading image…' : 'Save'}
          </button>
        </form>
      </ContentDrawer>

      <ContentDrawer
        open={lessonCourse !== null}
        onClose={() => {
          if (addLesson.isPending) return;
          setLessonCourse(null);
        }}
        title="Add lesson"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            addLesson.mutate();
          }}
        >
          <p className="muted small">
            This lesson is added to {lessonCourse?.title}. Attach the video or file from Lessons
            & resources after it is saved. Publishing the course also publishes draft lessons.
          </p>
          <div className="field">
            <label htmlFor="lesson-title">Title</label>
            <input
              id="lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              required
              minLength={1}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="lesson-minutes">Duration (minutes)</label>
            <input
              id="lesson-minutes"
              type="number"
              min={0}
              value={lessonMinutes}
              onChange={(e) => setLessonMinutes(e.target.value)}
            />
          </div>
          <label className="choice-list">
            <input
              type="checkbox"
              checked={lessonPreview}
              onChange={(e) => setLessonPreview(e.target.checked)}
            />
            Preview lesson, open without purchase
          </label>
          <div className="field">
            <label htmlFor="lesson-description">Description</label>
            <textarea
              id="lesson-description"
              value={lessonDescription}
              onChange={(e) => setLessonDescription(e.target.value)}
              rows={4}
            />
          </div>
          <button type="submit" className="btn" disabled={addLesson.isPending || !lessonTitle.trim()}>
            {addLesson.isPending ? 'Adding…' : 'Add lesson'}
          </button>
          {addLesson.error instanceof Error ? (
            <p className="error">{addLesson.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>

      <ContentDrawer
        open={manageCourse !== null}
        onClose={() => setManageCourse(null)}
        title={manageCourse ? `Lessons — ${manageCourse.title}` : 'Lessons'}
        size="full"
      >
        <p className="muted small">
          Learners only see published lessons. Publish each draft here, or publish the
          whole course to publish all draft lessons at once.
        </p>
        {courseDetail.isLoading ? <p className="muted">Loading lessons…</p> : null}
        {courseDetail.error instanceof Error ? (
          <p className="error">{courseDetail.error.message}</p>
        ) : null}
        {publishLesson.error instanceof Error ? (
          <p className="error">{publishLesson.error.message}</p>
        ) : null}
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Lifecycle</th>
                <th>Preview</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(courseDetail.data?.lessons ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No lessons yet. Use Add lesson first.
                  </td>
                </tr>
              ) : (
                (courseDetail.data?.lessons ?? []).map((lesson) => (
                  <tr key={lesson.id}>
                    <td>{lesson.sortOrder}</td>
                    <td>{lesson.title}</td>
                    <td>
                      <StatusPill value={lesson.lifecycle} />
                    </td>
                    <td>{lesson.isPreview ? 'Yes' : 'No'}</td>
                    <td>
                      {hasPermission('content.publish') &&
                      lesson.lifecycle === 'draft' ? (
                        <button
                          type="button"
                          className="btn"
                          disabled={publishLesson.isPending}
                          onClick={() =>
                            publishLesson.mutate({
                              courseId: manageCourse!.id,
                              lessonId: lesson.id,
                            })
                          }
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
      </ContentDrawer>
    </section>
  );
}
