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

type Order = {
  id: string;
  learnerId: string;
  status: string;
  amountPaise: number;
  providerStatus: string;
  externalReference: string | null;
  createdAt?: string;
  product?: { title: string; sku: string };
};

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [learnerId, setLearnerId] = useState('');
  const [productId, setProductId] = useState('');
  const [reference, setReference] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');

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
      setDrawerOpen(false);
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
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (r) => `${r.product?.title ?? ''} ${r.product?.sku ?? ''} ${r.learnerId} ${r.externalReference ?? ''}`,
    );
    next = filterWhen(next, status, (r, v) => r.status === v);
    next = filterWhen(next, provider, (r, v) => r.providerStatus === v);
    return next;
  }, [rows, search, status, provider]);

  const statusOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.status)),
    [rows],
  );
  const providerOptions = useMemo(
    () => distinctOptions(rows.map((r) => r.providerStatus)),
    [rows],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Orders & payments</h1>
          <p>Orders stay pending until you record a real gateway reference. No payment is invented.</p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Create order
          </button>
        </PageHeaderActions>
      </div>
      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No orders"
      >
        <TableFilterBar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: 'Search product, learner, reference…',
          }}
          selects={[
            {
              id: 'status',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: statusOptions,
            },
            {
              id: 'provider',
              label: 'Provider',
              value: provider,
              onChange: setProvider,
              options: providerOptions,
            },
          ]}
          onReset={() => {
            setSearch('');
            setStatus('');
            setProvider('');
          }}
        />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rows match filters.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.product?.title ?? '—'}</td>
                    <td>₹{(row.amountPaise / 100).toFixed(2)}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>{row.providerStatus}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={reference.trim().length < 4}
                        onClick={() => reconcile.mutate(row.id)}
                      >
                        Reconcile
                      </button>
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
        title="Create pending order"
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
            <label htmlFor="order-learner">Learner ID</label>
            <input
              id="order-learner"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="order-product">Product ID</label>
            <input
              id="order-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="order-ref">Gateway reference for reconcile</label>
            <input
              id="order-ref"
              value={reference}
              minLength={4}
              onChange={(e) => setReference(e.target.value)}
            />
            <p className="muted small">Used when you click Reconcile on a row in the table.</p>
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>
            Create pending order
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
