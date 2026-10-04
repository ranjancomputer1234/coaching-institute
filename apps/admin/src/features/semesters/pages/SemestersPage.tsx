import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Semester = {
  id: string;
  title: string;
  index: number;
  course: { id: string; title: string };
};

type Review = {
  id: string;
  status: string;
  createdAt: string;
  checklistJson: string;
  semester: { id: string; title: string; index: number };
  enrollment: {
    id: string;
    learner: { firstName: string; lastName: string };
    course: { title: string };
  };
};

type Course = { id: string; title: string };

export function SemestersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [index, setIndex] = useState(1);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [semesterId, setSemesterId] = useState('');

  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => apiFetch<Semester[]>('/admin/semesters'),
  });
  const reviews = useQuery({
    queryKey: ['semester-reviews'],
    queryFn: () => apiFetch<Review[]>('/admin/semester-reviews'),
  });
  const courses = useQuery({
    queryKey: ['courses'],
    queryFn: () => apiFetch<Course[]>('/admin/courses'),
  });

  // learners endpoint includes enrollments on detail only; use seed helper via submit after picking from reviews context
  // For submit-review we need enrollment IDs — fetch learners and courses and create via a lightweight list from dashboard seed.
  // Simplest: load learners detail is heavy; expose enrollment by loading learner list isn't enough.
  // Use a local note that submit uses enrollment from seed — fetch via admin by reading semester-reviews after submit.
  // We'll add a quick enrollments fetch by reusing courses + a custom approach: call learners and for each... too heavy.
  // Instead store enrollment ids from seed in a query to a new endpoint — for now use text input for enrollmentId.

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/semesters', {
        method: 'POST',
        body: JSON.stringify({ courseId, title, index: Number(index) }),
      }),
    onSuccess: () => {
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
    },
  });

  const submitReview = useMutation({
    mutationFn: () =>
      apiFetch('/admin/semester-reviews/submit', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, semesterId }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['semester-reviews'] }),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: 'approve' | 'request-changes';
    }) =>
      apiFetch(`/admin/semester-reviews/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({
          learnerFeedback:
            action === 'approve'
              ? 'Semester approved. Next stage unlocked.'
              : 'Please complete the outstanding requirements.',
          reason: action === 'approve' ? 'Requirements met' : 'Gaps remain',
        }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['semester-reviews'] }),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Semesters & reviews</h1>
          <p>Configure semesters and approve unlocks atomically</p>
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
            <label>Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {(courses.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Index</label>
            <input
              type="number"
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              required
            />
          </div>
          <button type="submit" className="btn">
            Add semester
          </button>
        </form>
      ) : null}

      <div className="panel padded" style={{ marginBottom: '1rem' }}>
        <h2>Submit review (when requirements complete)</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitReview.mutate();
          }}
        >
          <div className="field">
            <label>Enrollment ID</label>
            <input
              value={enrollmentId}
              onChange={(e) => setEnrollmentId(e.target.value)}
              placeholder="from seed / learner enrollments"
              required
            />
          </div>
          <div className="field">
            <label>Semester</label>
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {(semesters.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course.title} · S{s.index} {s.title}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-ghost">
            Submit for review
          </button>
        </form>
        {submitReview.error instanceof Error ? (
          <p className="error">{submitReview.error.message}</p>
        ) : null}
      </div>

      <h2>Semester definitions</h2>
      <PageState
        loading={semesters.isLoading}
        error={semesters.error instanceof Error ? semesters.error : null}
        empty={!semesters.isLoading && (semesters.data?.length ?? 0) === 0}
        emptyTitle="No semesters"
      >
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Index</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {(semesters.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.course.title}</td>
                  <td>{s.index}</td>
                  <td>{s.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>

      <h2>Pending semester reviews</h2>
      <PageState
        loading={reviews.isLoading}
        error={reviews.error instanceof Error ? reviews.error : null}
        empty={!reviews.isLoading && (reviews.data?.length ?? 0) === 0}
        emptyTitle="No pending reviews"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Course</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(reviews.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.enrollment.learner.firstName}{' '}
                    {r.enrollment.learner.lastName}
                  </td>
                  <td>{r.enrollment.course.title}</td>
                  <td>
                    S{r.semester.index} {r.semester.title}
                  </td>
                  <td>
                    <StatusPill value={r.status} />
                  </td>
                  <td className="action-row">
                    {hasPermission('semester.approve') ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          decide.mutate({ id: r.id, action: 'approve' })
                        }
                      >
                        Approve & unlock
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        decide.mutate({ id: r.id, action: 'request-changes' })
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
