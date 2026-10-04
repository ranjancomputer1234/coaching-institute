import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { PageState, StatusPill } from '../../../shared/ui/PageState';

type Order = {
  id: string;
  learnerId: string;
  status: string;
  amountPaise: number;
  providerStatus: string;
  externalReference: string | null;
  product?: { title: string; sku: string };
};

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [learnerId, setLearnerId] = useState('');
  const [productId, setProductId] = useState('');
  const [reference, setReference] = useState('');

  const list = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiFetch<Order[]>('/admin/orders'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/orders', {
        method: 'POST',
        body: JSON.stringify({ learnerId, productId }),
      }),
    onSuccess: () => {
      setLearnerId('');
      setProductId('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const reconcile = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/orders/${id}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ externalReference: reference }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
  });

  const rows = list.data ?? [];

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Orders & payments</h1>
          <p>Orders stay pending until you record a real gateway reference. No payment is invented.</p>
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
          <label htmlFor="order-learner">Learner ID</label>
          <input id="order-learner" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="order-product">Product ID</label>
          <input id="order-product" value={productId} onChange={(e) => setProductId(e.target.value)} required />
        </div>
        <button className="btn" type="submit" disabled={create.isPending}>Create pending order</button>
      </form>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="order-ref">Gateway reference for reconcile</label>
        <input id="order-ref" value={reference} minLength={4} onChange={(e) => setReference(e.target.value)} />
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No orders"
      >
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.product?.title ?? '—'}</td>
                  <td>₹{(row.amountPaise / 100).toFixed(2)}</td>
                  <td><StatusPill value={row.status} /></td>
                  <td>{row.providerStatus}</td>
                  <td>
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={reference.trim().length < 4}
                      onClick={() => reconcile.mutate(row.id)}
                    >
                      Reconcile
                    </button>
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
