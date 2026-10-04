import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Doc = {
  id: string;
  title: string;
  documentType: string;
  status: string;
  serial: string | null;
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
  const [docTitle, setDocTitle] = useState('');
  const [learnerId, setLearnerId] = useState('');
  const [reason, setReason] = useState('Issued in error');

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

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Issue stores an encrypted PDF key. No public download link is created.</p>
        </div>
      </div>
      <form
        className="inline-form panel padded"
        onSubmit={(event) => {
          event.preventDefault();
          issue.mutate();
        }}
      >
        <div className="field">
          <label htmlFor={`${documentType}-learner`}>Learner ID</label>
          <input id={`${documentType}-learner`} value={learnerId} onChange={(e) => setLearnerId(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor={`${documentType}-title`}>Title</label>
          <input id={`${documentType}-title`} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={issue.isPending}>Issue</button>
        {issue.error instanceof Error ? <p className="error">{issue.error.message}</p> : null}
      </form>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No documents issued"
      >
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
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>
                    {row.learner
                      ? `${row.learner.firstName} ${row.learner.lastName}`
                      : '—'}
                  </td>
                  <td>{row.serial ?? '—'}</td>
                  <td><StatusPill value={row.status} /></td>
                  <td>
                    {row.status !== 'revoked' ? (
                      <button className="btn-danger" type="button" onClick={() => revoke.mutate(row.id)}>
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageState>
      <div className="field" style={{ maxWidth: 360, marginTop: 12 }}>
        <label htmlFor="revoke-reason">Revoke reason</label>
        <input id="revoke-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </section>
  );
}
