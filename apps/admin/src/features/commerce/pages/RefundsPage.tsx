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

type Refund = {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  amountPaise: number;
};

export function RefundsPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const list = useQuery({
    queryKey: ['refunds'],
    queryFn: () => apiFetch<Refund[]>('/admin/refunds'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/refunds', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          reason,
          amountPaise: Number(amount) * 100,
        }),
      }),
    onSuccess: () => {
      setOrderId('');
      setReason('');
      setAmount('');
      setDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/refunds/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['refunds'] }),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(next, search, (r) => `${r.orderId} ${r.reason}`);
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
          <h1>Refunds</h1>
          <p>Approval is recorded manually. The payment gateway is not called.</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Request refund
          </button>
        </PageHeaderActions>
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No refund requests"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search order or reason…',
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
                <th>Order</th>
                <th>Amount</th>
                <th>Reason</th>
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
                    <td>{row.orderId}</td>
                    <td>₹{(row.amountPaise / 100).toFixed(2)}</td>
                    <td>{row.reason}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>
                      {row.status === 'pending' ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => approve.mutate(row.id)}
                        >
                          Approve
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
        title="Request refund"
        size="full"
      >
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="field">
            <label htmlFor="refund-order">Order ID</label>
            <input
              id="refund-order"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="refund-amount">Amount (INR)</label>
            <input
              id="refund-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="refund-reason">Reason</label>
            <input
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Request
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
