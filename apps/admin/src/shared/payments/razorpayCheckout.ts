import { apiFetch } from '../api/client';

export type RazorpayCheckoutResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CreateOrderResponse = {
  order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  instituteOrderId: string | null;
};

type VerifyResponse = {
  success: boolean;
  verified: boolean;
  orderId: string | null;
  paymentId: string;
  accessGranted?: boolean;
  alreadyPaid?: boolean;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-razorpay-checkout]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Razorpay checkout')),
      );
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function startRazorpayCheckout(input: {
  orderId?: string;
  amountPaise?: number;
  name?: string;
  description?: string;
  prefillEmail?: string;
  prefillContact?: string;
}): Promise<VerifyResponse> {
  await loadCheckoutScript();
  if (!window.Razorpay) {
    throw new Error('Razorpay checkout is unavailable in this browser');
  }

  const created = await apiFetch<CreateOrderResponse>('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.amountPaise != null ? { amount: input.amountPaise } : {}),
    }),
  });

  const keyFromEnv = (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim();
  const key = created.key_id || keyFromEnv;
  if (!key) {
    throw new Error('Razorpay key id is missing. Set VITE_RAZORPAY_KEY_ID or API keys.');
  }

  const checkoutResult = await new Promise<RazorpayCheckoutResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key,
      amount: created.amount,
      currency: created.currency,
      name: input.name ?? 'Ranjan Computer Institute',
      description: input.description ?? 'Course purchase',
      order_id: created.order_id,
      prefill: {
        email: input.prefillEmail,
        contact: input.prefillContact,
      },
      theme: { color: '#3d5afe' },
      handler(response: RazorpayCheckoutResult) {
        resolve(response);
      },
      modal: {
        ondismiss() {
          reject(new Error('Payment cancelled'));
        },
      },
    });

    rzp.on('payment.failed', (response: unknown) => {
      const detail =
        response &&
        typeof response === 'object' &&
        'error' in response &&
        response.error &&
        typeof response.error === 'object' &&
        'description' in response.error
          ? String((response.error as { description?: string }).description)
          : 'Payment failed';
      reject(new Error(detail));
    });

    rzp.open();
  });

  return apiFetch<VerifyResponse>('/payments/verify-payment', {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id: checkoutResult.razorpay_order_id,
      razorpay_payment_id: checkoutResult.razorpay_payment_id,
      razorpay_signature: checkoutResult.razorpay_signature,
      orderId: created.instituteOrderId ?? input.orderId,
    }),
  });
}
