import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../shared/api/client';
import { PageState } from '../../../shared/ui/PageState';

type DashboardMetrics = {
  learners: {
    total: number;
    active: number;
    suspended: number;
    pendingVerification: number;
  };
  enrollments: { total: number };
  courses: { published: number; draft: number };
  explore: { published: number };
  banners: { published: number; scheduled: number };
  queues: {
    draftsAwaitingReview: number;
    suspendedLearners: number;
  };
  recentAudit: Array<{
    id: string;
    occurredAtUtc: string;
    actorDisplay: string | null;
    action: string;
    resourceType: string;
  }>;
};

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardMetrics>('/admin/dashboard'),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Operational overview for REDI admin staff</p>
        </div>
      </div>

      <PageState
        loading={isLoading}
        error={error instanceof Error ? error : null}
      >
        {data ? (
          <>
            <div className="metric-grid">
              <Link className="metric-card" to="/learners">
                <span className="muted">Learners</span>
                <strong>{data.learners.total}</strong>
                <span className="muted">
                  {data.learners.active} active · {data.learners.suspended}{' '}
                  suspended
                </span>
              </Link>
              <Link className="metric-card" to="/courses">
                <span className="muted">Courses</span>
                <strong>{data.courses.published}</strong>
                <span className="muted">{data.courses.draft} drafts</span>
              </Link>
              <Link className="metric-card" to="/explore">
                <span className="muted">Explore sections</span>
                <strong>{data.explore.published}</strong>
                <span className="muted">published</span>
              </Link>
              <Link className="metric-card" to="/banners">
                <span className="muted">Banners</span>
                <strong>{data.banners.published}</strong>
                <span className="muted">
                  {data.banners.scheduled} scheduled
                </span>
              </Link>
            </div>

            <div className="split-panels">
              <div className="panel padded">
                <h2>Action queues</h2>
                <ul className="queue-list">
                  <li>
                    <Link to="/learners?state=suspended">
                      Suspended learners ({data.queues.suspendedLearners})
                    </Link>
                  </li>
                  <li>
                    Courses in review ({data.queues.draftsAwaitingReview})
                  </li>
                  <li>
                    Enrollments total: {data.enrollments.total}
                  </li>
                </ul>
              </div>
              <div className="panel padded">
                <h2>Recent admin activity</h2>
                {data.recentAudit.length === 0 ? (
                  <p className="muted">No audit events yet.</p>
                ) : (
                  <ul className="queue-list">
                    {data.recentAudit.map((event) => (
                      <li key={event.id}>
                        <strong>{event.action}</strong>
                        <span className="muted">
                          {' '}
                          · {event.actorDisplay ?? 'system'} ·{' '}
                          {new Date(event.occurredAtUtc).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p>
                  <Link to="/audit">Open audit log</Link>
                </p>
              </div>
            </div>
          </>
        ) : null}
      </PageState>
    </section>
  );
}
