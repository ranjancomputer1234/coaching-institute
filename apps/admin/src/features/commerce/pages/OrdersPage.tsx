import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/AuthContext';
import {
  distinctOptions,
  filterBySearch,
  filterWhen,
} from '../../../shared/lib/tableFilters';
import { startRazorpayCheckout } from '../../../shared/payments/razorpayCheckout';
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
  product?: { title: string; sku: string; courseId?: string | null };
};

type Learner = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  sku: string;
  title: string;
  pricePaise: number;
  courseId?: string | null;
  lifecycle?: string;
};

type ReconcileResult = {
  order: Order;
  entitlement: { id: string; courseId: string | null } | null;
  accessGranted: boolean;
};

type PaymentsConfig = {
  configured: boolean;
  keyId: string | null;
  provider: string;
};

function isPaid(status: string) {
  return status === 'paid' || status === 'paid_manual' || status === 'paid_razorpay';
}

export function OrdersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [learnerId, setLearnerId] = useState('');
  const [productId, setProductId] = useState('');
  const [reference, setReference] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [lastReconcile, setLastReconcile] = useState<ReconcileResult | null>(null);
  const [payNote, setPayNote] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const canReconcile = hasPermission('payments.refund_approve');
  const canPay = hasPermission('payments.read');

  const paymentsConfig = useQuery({
    queryKey: ['payments-config'],
    queryFn: () => apiFetch<PaymentsConfig>('/payments/config'),
  });

  const list = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiFetch<Order[]>('/admin/orders'),
  });

  const learners = useQuery({
    queryKey: ['learners', 'order-picker'],
    queryFn: () => apiFetch<Learner[]>('/admin/learners'),
    enabled: drawerOpen,
  });

  const products = useQuery({
    queryKey: ['products', 'order-picker'],
    queryFn: () => apiFetch<Product[]>('/admin/products'),
    enabled: drawerOpen,
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
      apiFetch<ReconcileResult>(`/admin/orders/${id}/reconcile`, {
        method: 'POST',
        body: JSON.stringify({ externalReference: reference }),
      }),
    onSuccess: (result) => {
      setLastReconcile(result);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
  });

  const pay = useMutation({
    mutationFn: async (order: Order) => {
      setPayingOrderId(order.id);
      setPayError(null);
      setPayNote(null);
      return startRazorpayCheckout({
        orderId: order.id,
        name: 'Ranjan Computer Institute',
        description: order.product?.title ?? 'Course purchase',
      });
    },
    onSuccess: (result) => {
      setPayNote(
        result.alreadyPaid
          ? 'Order was already marked paid.'
          : result.accessGranted
            ? `Payment verified. Course access granted.`
            : `Payment verified (${result.paymentId}).`,
      );
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['entitlements'] });
    },
    onError: (error) => {
      setPayError(error instanceof Error ? error.message : 'Payment failed');
    },
    onSettled: () => setPayingOrderId(null),
  });

  const rows = list.data ?? [];
  const filtered = useMemo(() => {
    let next = rows;
    next = filterBySearch(
      next,
      search,
      (r) =>
        `${r.product?.title ?? ''} ${r.product?.sku ?? ''} ${r.learnerId} ${r.externalReference ?? ''}`,
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

  const sellableProducts = useMemo(
    () =>
      (products.data ?? []).filter(
        (p) => p.pricePaise >= 100 && p.lifecycle !== 'archived',
      ),
    [products.data],
  );

  const selectedProduct = sellableProducts.find((p) => p.id === productId);
  const razorpayReady = Boolean(paymentsConfig.data?.configured);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Orders & payments</h1>
          <p>
            Pick a learner and a product, create a pending order, then collect
            payment with Razorpay. Verified payments grant course access when the
            product has a course ID.
          </p>
        </div>
        <PageHeaderActions>
          <button type="button" className="btn" onClick={() => setDrawerOpen(true)}>
            Create order
          </button>
        </PageHeaderActions>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <p className="muted" style={{ margin: 0 }}>
          Razorpay:{' '}
          {paymentsConfig.isLoading
            ? 'Checking…'
            : razorpayReady
              ? `Configured (${paymentsConfig.data?.keyId ?? 'key present'})`
              : 'Not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the API'}
        </p>
      </div>

      {lastReconcile ? (
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <p>
            Last reconcile: <StatusPill value={lastReconcile.order.status} />
            {' · '}
            {lastReconcile.accessGranted
              ? `Access granted${lastReconcile.entitlement?.courseId ? ` for course ${lastReconcile.entitlement.courseId}` : ''}`
              : 'No course linked on product — grant from Entitlements if needed'}
          </p>
        </div>
      ) : null}

      {payNote ? <p className="muted">{payNote}</p> : null}
      {payError ? <p className="error">{payError}</p> : null}
      {reconcile.error instanceof Error ? (
        <p className="error">{reconcile.error.message}</p>
      ) : null}

      <PageState
        loading={list.isLoading}
        error={list.error instanceof Error ? list.error : null}
        empty={!list.isLoading && rows.length === 0}
        emptyTitle="No orders"
        emptyHint="Use Create order, then Pay with Razorpay on the new row."
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
        {canReconcile ? (
          <div className="panel" style={{ marginBottom: '0.75rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="order-ref-table">Manual reconcile reference</label>
              <input
                id="order-ref-table"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Gateway / UTR reference (min 4 characters)"
              />
            </div>
          </div>
        ) : null}
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Course</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider</th>
                <th></th>
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
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.product?.title ?? '—'}</td>
                    <td className="muted">{row.product?.courseId ?? '—'}</td>
                    <td>₹{(row.amountPaise / 100).toFixed(2)}</td>
                    <td>
                      <StatusPill value={row.status} />
                    </td>
                    <td>{row.providerStatus}</td>
                    <td className="action-row">
                      {canPay && !isPaid(row.status) ? (
                        <button
                          className="btn"
                          type="button"
                          disabled={!razorpayReady || pay.isPending}
                          onClick={() => pay.mutate(row)}
                        >
                          {payingOrderId === row.id ? 'Opening…' : 'Pay with Razorpay'}
                        </button>
                      ) : null}
                      {canReconcile && !isPaid(row.status) ? (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={reference.trim().length < 4 || reconcile.isPending}
                          onClick={() => reconcile.mutate(row.id)}
                        >
                          Reconcile
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
        onClose={() => {
          setDrawerOpen(false);
          create.reset();
        }}
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
            <label htmlFor="order-learner">Learner</label>
            <select
              id="order-learner"
              value={learnerId}
              onChange={(e) => setLearnerId(e.target.value)}
              required
              disabled={learners.isLoading}
            >
              <option value="">
                {learners.isLoading ? 'Loading learners…' : 'Select a learner'}
              </option>
              {(learners.data ?? []).map((learner) => (
                <option key={learner.id} value={learner.id}>
                  {`${learner.firstName} ${learner.lastName}`.trim()}
                  {learner.email ? ` · ${learner.email}` : ''}
                  {learner.phone ? ` · ${learner.phone}` : ''}
                </option>
              ))}
            </select>
            <p className="field-hint">
              Choose from existing learners. Do not type a made-up ID.
            </p>
          </div>
          <div className="field">
            <label htmlFor="order-product">Product</label>
            <select
              id="order-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              disabled={products.isLoading}
            >
              <option value="">
                {products.isLoading
                  ? 'Loading products…'
                  : sellableProducts.length
                    ? 'Select a product'
                    : 'No sellable products yet'}
              </option>
              {sellableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} · {product.sku} · ₹
                  {(product.pricePaise / 100).toFixed(2)}
                </option>
              ))}
            </select>
            {sellableProducts.length === 0 && !products.isLoading ? (
              <p className="error">
                Create a product under Products & pricing first (price at least ₹1).
              </p>
            ) : null}
            {selectedProduct ? (
              <p className="field-hint">
                Amount: ₹{(selectedProduct.pricePaise / 100).toFixed(2)}
                {selectedProduct.courseId
                  ? ` · unlocks course ${selectedProduct.courseId}`
                  : ' · no course linked (pay will not auto-grant access)'}
              </p>
            ) : null}
          </div>
          {create.error instanceof Error ? (
            <p className="error">{create.error.message}</p>
          ) : null}
          <button
            className="btn"
            type="submit"
            disabled={
              create.isPending || !learnerId || !productId || sellableProducts.length === 0
            }
          >
            {create.isPending ? 'Creating…' : 'Create pending order'}
          </button>
        </form>
      </ContentDrawer>
    </section>
  );
}
