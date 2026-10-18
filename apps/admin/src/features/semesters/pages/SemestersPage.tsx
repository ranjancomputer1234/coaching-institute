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

type Semester = {
  id: string;
  title: string;
  index: number;
  createdAt?: string;
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
  const [drawer, setDrawer] = useState<'add' | 'submit' | null>(null);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [index, setIndex] = useState(1);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [semesterId, setSemesterId] = useState('');

  const [semSearch, setSemSearch] = useState('');
  const [semCourse, setSemCourse] = useState('');
  const [revSearch, setRevSearch] = useState('');
  const [revStatus, setRevStatus] = useState('');
  const [revFrom, setRevFrom] = useState('');
  const [revTo, setRevTo] = useState('');

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

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/semesters', {
        method: 'POST',
        body: JSON.stringify({ courseId, title, index: Number(index) }),
      }),
    onSuccess: () => {
      setTitle('');
      setDrawer(null);
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
    },
  });

  const submitReview = useMutation({
    mutationFn: () =>
      apiFetch('/admin/semester-reviews/submit', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, semesterId }),
      }),
    onSuccess: () => {
      setDrawer(null);
      queryClient.invalidateQueries({ queryKey: ['semester-reviews'] });
    },
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

  const semesterRows = semesters.data ?? [];
  const reviewRows = reviews.data ?? [];

  const filteredSemesters = useMemo(() => {
    let rows = semesterRows;
    rows = filterBySearch(
      rows,
      semSearch,
      (s) => `${s.course.title} ${s.title} ${s.index}`,
    );
    rows = filterWhen(rows, semCourse, (s, v) => s.course.id === v);
    return rows;
  }, [semesterRows, semSearch, semCourse]);

  const filteredReviews = useMemo(() => {
    let rows = reviewRows;
    rows = filterBySearch(
      rows,
      revSearch,
      (r) =>
        `${r.enrollment.learner.firstName} ${r.enrollment.learner.lastName} ${r.enrollment.course.title} ${r.semester.title}`,
    );
    rows = filterWhen(rows, revStatus, (r, v) => r.status === v);
    rows = filterByDateRange(rows, revFrom, revTo, (r) => r.createdAt);
    return rows;
  }, [reviewRows, revSearch, revStatus, revFrom, revTo]);

  const reviewStatusOptions = useMemo(
    () => distinctOptions(reviewRows.map((r) => r.status)),
    [reviewRows],
  );

  const canCreate = hasPermission('content.create');

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Semesters & reviews</h1>
          <p>Configure semesters and approve unlocks atomically</p>
        </div>
        <PageHeaderActions>
          {canCreate ? (
            <button type="button" className="btn" onClick={() => setDrawer('add')}>
              Add semester
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => setDrawer('submit')}>
            Submit review
          </button>
        </PageHeaderActions>
      </div>

      <h2 className="section-block-title">Semester definitions</h2>
      <PageState
        loading={semesters.isLoading}
        error={semesters.error instanceof Error ? semesters.error : null}
        empty={!semesters.isLoading && semesterRows.length === 0}
        emptyTitle="No semesters"
      >
        <TableFilterBar
          search={{
            value: semSearch,
            onChange: setSemSearch,
            placeholder: 'Search course or title…',
          }}
          selects={[
            {
              id: 'course',
              label: 'Course',
              value: semCourse,
              onChange: setSemCourse,
              options: semesterRows
                .reduce<{ value: string; label: string }[]>((acc, s) => {
                  if (!acc.some((o) => o.value === s.course.id)) {
                    acc.push({ value: s.course.id, label: s.course.title });
                  }
                  return acc;
                }, [])
                .sort((a, b) => a.label.localeCompare(b.label)),
            },
          ]}
          onReset={() => {
            setSemSearch('');
            setSemCourse('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Index</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {filteredSemesters.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filteredSemesters.map((s) => (
                  <tr key={s.id}>
                    <td>{s.course.title}</td>
                    <td>{s.index}</td>
                    <td>{s.title}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <h2 className="section-block-title">Semester reviews</h2>
      <PageState
        loading={reviews.isLoading}
        error={reviews.error instanceof Error ? reviews.error : null}
        empty={!reviews.isLoading && reviewRows.length === 0}
        emptyTitle="No reviews"
      >
        <TableFilterBar
          search={{
            value: revSearch,
            onChange: setRevSearch,
            placeholder: 'Search learner or course…',
          }}
          dateFrom={{ value: revFrom, onChange: setRevFrom, label: 'From' }}
          dateTo={{ value: revTo, onChange: setRevTo, label: 'To' }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: revStatus,
              onChange: setRevStatus,
              options: reviewStatusOptions,
            },
          ]}
          onReset={() => {
            setRevSearch('');
            setRevStatus('');
            setRevFrom('');
            setRevTo('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Course</th>
                <th>Semester</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filteredReviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.enrollment.learner.firstName} {r.enrollment.learner.lastName}
                    </td>
                    <td>{r.enrollment.course.title}</td>
                    <td>
                      S{r.semester.index} {r.semester.title}
                    </td>
                    <td>
                      <StatusPill value={r.status} />
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawer === 'add'}
        onClose={() => setDrawer(null)}
        title="Add semester"
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
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
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
          <button type="submit" className="btn" disabled={create.isPending}>
            Add semester
          </button>
        </form>
      </ContentDrawer>

      <ContentDrawer
        open={drawer === 'submit'}
        onClose={() => setDrawer(null)}
        title="Submit semester review"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            submitReview.mutate();
          }}
        >
          <p className="muted small">
            Use when the learner has completed semester requirements. Enrollment ID comes from
            seed data or the learner enrollments API.
          </p>
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
          <button type="submit" className="btn" disabled={submitReview.isPending}>
            Submit for review
          </button>
          {submitReview.error instanceof Error ? (
            <p className="error">{submitReview.error.message}</p>
          ) : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
