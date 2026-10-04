import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../shared/api/client';
import { PageState } from '../../../shared/ui/PageState';

type AuditEvent = {
  id: string;
  occurredAtUtc: string;
  actorDisplay: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  outcome: string;
  severity: string;
};

export function AuditPage() {
  const list = useQuery({
    queryKey: ['audit'],
    queryFn: () => apiFetch<AuditEvent[]>('/admin/audit-events'),
  });

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Audit log</h1>
          <p>Append-only history of high-impact admin actions</p>
        </div>
      </div>

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && (list.data?.length ?? 0) === 0}
        emptyTitle="No audit events"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>When (UTC)</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Outcome</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.occurredAtUtc).toLocaleString()}</td>
                  <td>{event.actorDisplay ?? '—'}</td>
                  <td>{event.action}</td>
                  <td>
                    {event.resourceType}
                    {event.resourceId ? ` · ${event.resourceId}` : ''}
                  </td>
                  <td>{event.outcome}</td>
                  <td>{event.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
