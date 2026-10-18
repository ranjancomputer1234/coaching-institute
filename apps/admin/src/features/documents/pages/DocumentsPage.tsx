import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { ContentDrawer } from '../../../shared/ui/ContentDrawer';
import { PageHeaderActions } from '../../../shared/ui/PageHeaderActions';
import { PageState, StatusPill } from '../../../shared/ui/PageState';
import { TableFilterBar } from '../../../shared/ui/TableFilterBar';

type Doc = {
  id: string;
  title: string;
  documentType: string;
  status: string;
  serial: string | null;
  issuedAt?: string | null;
  learner?: { firstName: string; lastName: string; email: string | null };
};

export function DocumentsPage({
  documentType,
  title,
}: {
  documentType: 'certificate' | 'admit_card';
  title: string;
}) {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [reason, setReason] = useState('Issued in error');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const list = useQuery({
    queryKey: ['documents', documentType],
    queryFn: async () => {
      const rows = await apiFetch<Doc[]>('/admin/documents');
      return rows.filter((row) => row.documentType === documentType);
    },
  });

  const issue = useMutation({
    mutationFn: () =>
      apiFetch('/admin/documents/issue', {
        method: 'POST',
        body: JSON.stringify({
          learnerId,
          documentType,
          title: docTitle,
        }),
      }),
    onSuccess: () => {
      setDocTitle('');
      setLearnerId('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['documents', documentType] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/documents/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['documents', documentType] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (r) =>
        `${r.title} ${r.serial ?? ''} ${r.learner?.firstName ?? ''} ${r.learner?.lastName ?? ''}`,
    );
    next = filterWhen(next, status, (r, v) => r.status === v);
    return next;
  }, [rows, search, status]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.status)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Issue stores an encrypted PDF key. No public download link is created.</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Issue document
          </button>
        </PageHeaderActions>
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No documents issued"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search title, serial, learner…',
          }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: statusOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setStatus('');
          }}
        />
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Learner</th>
                <th>Serial</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>
                      {row.learner
                        ? `${row.learner.firstName} ${row.learner.lastName}`
                        : '—'}
                    </td>
                    <td>{row.serial ?? '—'}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>
                      {row.status !== 'revoked' ? (
                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => revoke.mutate(row.id)}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageState>

      <ContentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Issue document"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            issue.mutate();
          }}
        >
          <div className="field">
            <label htmlFor={`${documentType}-learner`}>Learner ID</label>
            <input
              id={`${documentType}-learner`}
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`${documentType}-title`}>Title</label>
            <input
              id={`${documentType}-title`}
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="revoke-reason">Default revoke reason</label>
            <input
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={issue.isPending}>
            Issue
          </button>
          {issue.error instanceof Error ? <p className="error">{issue.error.message}</p> : null}
        </form>
      </ContentDrawer>
    </section>
  );
}
