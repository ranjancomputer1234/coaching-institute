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

type Course = {
  id: string;
  slug: string;
  title: string;
  commercialMode: string;
  lifecycle: string;
  _count?: { lessons: number; enrollments: number };
};

export function CoursesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [lessonCourse, setLessonCourse] = useState<Course | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [search, setSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [mode, setMode] = useState('');

  const list = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiFetch<Course[]>('/admin/courses'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/courses', {
        method: 'POST',
        body: JSON.stringify({ title, slug, commercialMode: 'free' }),
      }),
    onSuccess: () => {
      setTitle('');
      setSlug('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/courses/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
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
        }),
      });
    },
    onSuccess: () => {
      setLessonTitle('');
      setLessonDescription('');
      setLessonCourse(null);
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const rows = list.data ?? [];
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
        {hasPermission('content.create') ? (
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
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Mode</th>
                <th>Lifecycle</th>
                <th>Lessons</th>
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
                filtered.map((course) => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td className="muted">{course.slug}</td>
                    <td>{course.commercialMode}</td>
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
                            addLesson.reset();
                            setLessonTitle('');
                            setLessonDescription('');
                            setLessonCourse(course);
                          }}
                        >
                          Add lesson
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
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
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
            & resources after it is saved.
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
    </section>
  );
}
