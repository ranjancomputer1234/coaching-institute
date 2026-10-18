import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

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
  const [drawer, setDrawer] = useState<'create' | 'submit' | null>(null);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [textBody, setTextBody] = useState('');

  const [projSearch, setProjSearch] = useState('');
  const [projCourse, setProjCourse] = useState('');
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [subFrom, setSubFrom] = useState('');
  const [subTo, setSubTo] = useState('');

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
      setDrawer(null);
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
      setDrawer(null);
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

  const projectRows = projects.data ?? [];
  const submissionRows = submissions.data ?? [];

  const filteredProjects = useMemo(() => {
    let rows = projectRows;
    rows = filterBySearch(rows, projSearch, (p) => `${p.title} ${p.course.title}`);
    rows = filterWhen(rows, projCourse, (p, v) => p.course.id === v);
    return rows;
  }, [projectRows, projSearch, projCourse]);

  const filteredSubmissions = useMemo(() => {
    let rows = submissionRows;
    rows = filterBySearch(
      rows,
      subSearch,
      (s) =>
        `${s.learner.firstName} ${s.learner.lastName} ${s.project.title} ${s.textBody ?? ''}`,
    );
    rows = filterWhen(rows, subStatus, (s, v) => s.status === v);
    rows = filterByDateRange(rows, subFrom, subTo, (s) => s.submittedAt);
    return rows;
  }, [submissionRows, subSearch, subStatus, subFrom, subTo]);

  const subStatusOptions = useMemo(
    () => distinctOptions(submissionRows.map((s) => s.status)),
    [submissionRows],
  );

  const canCreate = hasPermission('content.create');

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Projects & reviews</h1>
          <p>Author projects and review learner submissions</p>
        </div>
        <PageHeaderActions>
          {canCreate ? (
            <button type="button" className="btn" onClick={() => setDrawer('create')}>
              Create project
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => setDrawer('submit')}>
            Simulate submission
          </button>
        </PageHeaderActions>
      </div>

      <h2 className="section-block-title">Projects</h2>
      <PageState
        loading={projects.isLoading}
        error={projects.error instanceof Error ? projects.error : null}
        empty={!projects.isLoading && projectRows.length === 0}
        emptyTitle="No projects"
      >
        <TableFilterBar
          search={{
            value: projSearch,
            onChange: setProjSearch,
            placeholder: 'Search project or course…',
          }}
          selects={[
            {
              id: 'course',
              label: 'Course',
              value: projCourse,
              onChange: setProjCourse,
              options: projectRows
                .reduce<{ value: string; label: string }[]>((acc, p) => {
                  if (!acc.some((o) => o.value === p.course.id)) {
                    acc.push({ value: p.course.id, label: p.course.title });
                  }
                  return acc;
                }, [])
                .sort((a, b) => a.label.localeCompare(b.label)),
            },
          ]}
          onReset={() => {
            setProjSearch('');
            setProjCourse('');
          }}
        />
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Course</th>
                <th>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title}</td>
                    <td>{p.course.title}</td>
                    <td>{p._count?.submissions ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <h2 className="section-block-title">Pending submissions</h2>
      <PageState
        loading={submissions.isLoading}
        error={submissions.error instanceof Error ? submissions.error : null}
        empty={!submissions.isLoading && submissionRows.length === 0}
        emptyTitle="No pending submissions"
      >
        <TableFilterBar
          search={{
            value: subSearch,
            onChange: setSubSearch,
            placeholder: 'Search learner or project…',
          }}
          dateFrom={{ value: subFrom, onChange: setSubFrom, label: 'From' }}
          dateTo={{ value: subTo, onChange: setSubTo, label: 'To' }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: subStatus,
              onChange: setSubStatus,
              options: subStatusOptions,
            },
          ]}
          onReset={() => {
            setSubSearch('');
            setSubStatus('');
            setSubFrom('');
            setSubTo('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Project</th>
                <th>Text</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.learner.firstName} {s.learner.lastName}
                    </td>
                    <td>{s.project.title}</td>
                    <td>{s.textBody}</td>
                    <td>
                      <StatusPill value={s.status} />
                    </td>
                    <td>{new Date(s.submittedAt).toLocaleDateString()}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawer === 'create'}
        onClose={() => setDrawer(null)}
        title="Create project"
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
      </ContentDrawer>

      <ContentDrawer
        open={drawer === 'submit'}
        onClose={() => setDrawer(null)}
        title="Simulate learner submission"
        size="full"
      >
        <form
          className="stack-form"
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
          <button type="submit" className="btn">
            Submit
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
