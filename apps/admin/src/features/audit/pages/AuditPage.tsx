import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import {
  distinctOptions,
  filterByDateRange,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { PageState } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

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
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [severity, setSeverity] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const list = useQuery({
    queryKey: ['audit'],
    queryFn: () => apiFetch<AuditEvent[]>('/admin/audit-events'),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (e) =>
        `${e.action} ${e.actorDisplay ?? ''} ${e.resourceType} ${e.resourceId ?? ''} ${e.reason ?? ''}`,
    );
    next = filterWhen(next, action, (e, v) => e.action === v);
    next = filterWhen(next, resourceType, (e, v) => e.resourceType === v);
    next = filterWhen(next, severity, (e, v) => e.severity === v);
    next = filterByDateRange(next, dateFrom, dateTo, (e) => e.occurredAtUtc);
    return next;
  }, [rows, search, action, resourceType, severity, dateFrom, dateTo]);

  const actionOptions = useMemo(
    () => distinctOptions(rows.map((e) => e.action)),
    [rows],
  );
  const resourceOptions = useMemo(
    () => distinctOptions(rows.map((e) => e.resourceType)),
    [rows],
  );
  const severityOptions = useMemo(
    () => distinctOptions(rows.map((e) => e.severity)),
    [rows],
  );

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
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No audit events"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search action, actor, resource…',
          }}
          dateFrom={{ value: dateFrom, onChange: setDateFrom, label: 'From (UTC)' }}
          dateTo={{ value: dateTo, onChange: setDateTo, label: 'To (UTC)' }}
          selects={[
            {
              id: 'action',
              label: 'Action',
              value: action,
              onChange: setAction,
              options: actionOptions,
            },
            {
              id: 'resource',
              label: 'Resource',
              value: resourceType,
              onChange: setResourceType,
              options: resourceOptions,
            },
            {
              id: 'severity',
              label: 'Severity',
              value: severity,
              onChange: setSeverity,
              options: severityOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setAction('');
            setResourceType('');
            setSeverity('');
            setDateFrom('');
            setDateTo('');
          }}
        />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((event) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>
    </section>
  );
}
