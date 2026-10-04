import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Refund = {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  amountPaise: number;
};

export function RefundsPage() {
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');

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
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/refunds/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['refunds'] }),
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Refunds</h1>
          <p>Approval is recorded manually. The payment gateway is not called.</p>
        </div>
      </div>
      <form
        className="inline-form panel padded"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="field">
          <label htmlFor="refund-order">Order ID</label>
          <input id="refund-order" value={orderId} onChange={(e) => setOrderId(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="refund-amount">Amount (INR)</label>
          <input id="refund-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="refund-reason">Reason</label>
          <input id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={create.isPending}>Request</button>
      </form>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No refund requests"
      >
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
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.orderId}</td>
                  <td>₹{(row.amountPaise / 100).toFixed(2)}</td>
                  <td>{row.reason}</td>
                  <td><StatusPill value={row.status} /></td>
                  <td>
                    {row.status === 'requested' ? (
                      <button className="btn-ghost" type="button" onClick={() => approve.mutate(row.id)}>
                        Approve
                      </button>
                    ) : null}
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
