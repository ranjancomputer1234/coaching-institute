import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Project = {
  id: string;
  title: string;
  course: { id: string; title: string };
  _count?: { submissions: number };
};

type Submission = {
  id: string;
  status: string;
  textBody: string | null;
  submittedAt: string;
  project: { id: string; title: string };
  learner: { id: string; firstName: string; lastName: string };
};

type Course = { id: string; title: string };
type Learner = { id: string; firstName: string; lastName: string };

export function ProjectsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [textBody, setTextBody] = useState('');

  const projects = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/admin/projects'),
  });
  const submissions = useQuery({
    queryKey: ['project-submissions'],
    queryFn: () =>
      apiFetch<Submission[]>('/admin/projects/submissions?status=submitted'),
  });
  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiFetch<Course[]>('/admin/courses'),
  });
  const learners = useQuery({
    queryKey: ['learners'],
    queryFn: () => apiFetch<Learner[]>('/admin/learners'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/projects', {
        method: 'POST',
        body: JSON.stringify({ title, courseId }),
      }),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/projects/${projectId}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ learnerId, textBody }),
      }),
    onSuccess: () => {
      setTextBody('');
      queryClient.invalidateQueries({ queryKey: ['project-submissions'] });
    },
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: 'accept' | 'request-changes';
    }) =>
      apiFetch(`/admin/projects/submissions/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          learnerFeedback:
            action === 'accept'
              ? 'Accepted. Good work.'
              : 'Please revise and resubmit with the requested changes.',
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['project-submissions'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Projects & reviews</h1>
          <p>Author projects and review learner submissions</p>
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
            <label htmlFor="proj-title">Project title</label>
            <input
              id="proj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="proj-course">Course</label>
            <select
              id="proj-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Select course</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn">
            Create project
          </button>
        </form>
      ) : null}

      <div className="panel padded" style={{ marginBottom: '1rem' }}>
        <h2>Simulate learner submission</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <div className="field">
            <label>Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Learner</label>
            <select
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {(learners.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName} {l.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Text</label>
            <input
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-ghost">
            Submit
          </button>
        </form>
      </div>

      <PageState
        loading={submissions.isLoading}
        error={submissions.error instanceof Error ? submissions.error : null}
        empty={!submissions.isLoading && (submissions.data?.length ?? 0) === 0}
        emptyTitle="No pending submissions"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Project</th>
                <th>Text</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(submissions.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.learner.firstName} {s.learner.lastName}
                  </td>
                  <td>{s.project.title}</td>
                  <td>{s.textBody}</td>
                  <td>
                    <StatusPill value={s.status} />
                  </td>
                  <td className="action-row">
                    {hasPermission('semester.approve') ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          decide.mutate({ id: s.id, action: 'accept' })
                        }
                      >
                        Accept
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        decide.mutate({ id: s.id, action: 'request-changes' })
                      }
                    >
                      Request changes
                    </button>
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
