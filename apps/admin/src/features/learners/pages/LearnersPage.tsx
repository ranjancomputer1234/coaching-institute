import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  accountState: string;
  batch?: { name: string } | null;
};

export function LearnersPage() {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['learners', q],
    queryFn: () =>
      apiFetch<Learner[]>(
        `/admin/learners${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const detail = useQuery({
    queryKey: ['learner', selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiFetch<Learner>(`/admin/learners/${selectedId}`),
  });

  const suspend = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/learners/${id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Suspended from admin panel' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['learner', selectedId] });
    },
  });

  const reactivate = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/learners/${id}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Reactivated from admin panel' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learners'] });
      queryClient.invalidateQueries({ queryKey: ['learner', selectedId] });
    },
  });

  const rows = useMemo(() => list.data ?? [], [list.data]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Learners</h1>
          <p>Search and manage learner accounts</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search name, email, phone, ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search learners"
        />
      </div>

      <div className="split-panels">
        <PageState
          loading={list.isLoading}
          error={list.error instanceof Error ? list.error : null}
          empty={!list.isLoading && rows.length === 0}
          emptyTitle="No learners found"
          emptyHint="Try another search or seed the database."
        >
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>State</th>
                  <th>Batch</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((learner) => (
                  <tr
                    key={learner.id}
                    className={selectedId === learner.id ? 'row-selected' : ''}
                    onClick={() => setSelectedId(learner.id)}
                  >
                    <td>
                      {learner.firstName} {learner.lastName}
                    </td>
                    <td>
                      {learner.email ?? '—'}
                      <br />
                      <span className="muted">{learner.phone ?? '—'}</span>
                    </td>
                    <td>
                      <StatusPill value={learner.accountState} />
                    </td>
                    <td>{learner.batch?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageState>

        <div className="panel padded">
          <h2>Profile</h2>
          {!selectedId ? (
            <p className="muted">Select a learner to inspect.</p>
          ) : detail.isLoading ? (
            <p className="muted">Loading…</p>
          ) : detail.data ? (
            <>
              <p>
                <strong>
                  {detail.data.firstName} {detail.data.lastName}
                </strong>
              </p>
              <p className="muted">{detail.data.id}</p>
              <p>
                Email: {detail.data.email ?? '—'}
                <br />
                Phone: {detail.data.phone ?? '—'}
                <br />
                City: {detail.data.city ?? '—'}
              </p>
              <p>
                State: <StatusPill value={detail.data.accountState} />
              </p>
              {hasPermission('users.suspend') ? (
                <div className="action-row">
                  {detail.data.accountState === 'suspended' ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => reactivate.mutate(detail.data.id)}
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        if (
                          confirm(
                            'Suspend this learner? Active sessions should be revoked.',
                          )
                        ) {
                          suspend.mutate(detail.data.id);
                        }
                      }}
                    >
                      Suspend
                    </button>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="error">Failed to load learner</p>
          )}
        </div>
      </div>
    </section>
  );
}
