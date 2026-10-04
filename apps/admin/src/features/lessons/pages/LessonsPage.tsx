import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Resource = {
  id: string;
  title: string;
  kind: string;
  mimeType: string;
  downloadable: boolean;
  lifecycle: string;
  course?: { title: string } | null;
  lesson?: { title: string } | null;
};

export function LessonsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('pdf');
  const [storageKey, setStorageKey] = useState('');

  const list = useQuery({
    queryKey: ['resources'],
    queryFn: () => apiFetch<Resource[]>('/admin/resources'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/resources', {
        method: 'POST',
        body: JSON.stringify({
          title,
          kind,
          mimeType: kind === 'video' ? 'video/mp4' : 'application/pdf',
          storageKey: storageKey || undefined,
          downloadable: true,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      setStorageKey('');
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Lessons & resources</h1>
          <p>Protected files attached to courses and lessons</p>
        </div>
      </div>

      {hasPermission('content.create') ? (
        <form
          className="inline-form panel padded"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="resource-title">Title</label>
            <input
              id="resource-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="resource-kind">Kind</label>
            <select
              id="resource-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="pdf">PDF</option>
              <option value="video">Video</option>
              <option value="notes">Notes</option>
              <option value="audio">Audio</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="resource-key">Storage key</label>
            <input
              id="resource-key"
              value={storageKey}
              placeholder="private/course/file.enc"
              onChange={(event) => setStorageKey(event.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Add resource
          </button>
        </form>
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No resources yet"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Kind</th>
                <th>Course</th>
                <th>Lesson</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.kind}</td>
                  <td>{row.course?.title ?? '—'}</td>
                  <td>{row.lesson?.title ?? '—'}</td>
                  <td>
                    <StatusPill value={row.lifecycle} />
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
