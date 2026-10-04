import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../shared/api/client';
import { PageState } from '../../../shared/ui/PageState';

type Report = {
  generatedAt: string;
  learners: { total: number; active: number };
  learning: { courses: number; publishedCourses: number; activeEnrollments: number };
  assessments: { attempts: number; publishedResults: number };
  operations: {
    pendingOrders: number;
    openSupport: number;
    liveClasses: number;
    campaigns: number;
  };
  providers: Record<string, boolean>;
};

export function ReportsPage() {
  const report = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiFetch<Report>('/admin/reports/summary'),
  });

  const data = report.data;

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Operational snapshot from live records</p>
        </div>
      </div>
      <PageState
        loading={report.isLoading}
        error={report.error instanceof Error ? report.error : null}
        empty={false}
      >
        {data ? (
          <div className="metric-grid">
            <article className="metric-card">
              <h2>Learners</h2>
              <p>{data.learners.active} active of {data.learners.total}</p>
            </article>
            <article className="metric-card">
              <h2>Learning</h2>
              <p>{data.learning.publishedCourses} published courses</p>
              <p className="muted">{data.learning.activeEnrollments} active enrollments</p>
            </article>
            <article className="metric-card">
              <h2>Assessments</h2>
              <p>{data.assessments.attempts} attempts</p>
              <p className="muted">{data.assessments.publishedResults} published results</p>
            </article>
            <article className="metric-card">
              <h2>Operations</h2>
              <p>{data.operations.pendingOrders} pending orders</p>
              <p className="muted">{data.operations.openSupport} open support cases</p>
            </article>
          </div>
        ) : null}
      </PageState>
    </section>
  );
}
