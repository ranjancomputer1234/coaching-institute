import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

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
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');

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
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/courses/${id}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  const addLesson = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/courses/${id}/lessons`, {
        method: 'POST',
        body: JSON.stringify({ title: 'New lesson', sortOrder: 0 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Courses</h1>
          <p>Create, edit, and publish learning courses</p>
        </div>
      </div>

      {hasPermission('content.create') ? (
        <form
          className="inline-form panel padded"
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
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && (list.data?.length ?? 0) === 0}
        emptyTitle="No courses yet"
        emptyHint="Create a draft course to get started."
      >
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
              {(list.data ?? []).map((course) => (
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
                        onClick={() => addLesson.mutate(course.id)}
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
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
