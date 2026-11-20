import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

type RazorpayOrderResponse = {
  id: string;
  amount: number | string;
  currency: string;
  receipt?: string | null;
  status?: string;
};

@Injectable()
export class RazorpayService {
  private client: Razorpay | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.keyId() && this.keySecret());
  }

  keyId(): string {
    return this.config.get<string>('RAZORPAY_KEY_ID')?.trim() ?? '';
  }

  private keySecret(): string {
    return this.config.get<string>('RAZORPAY_KEY_SECRET')?.trim() ?? '';
  }

  private getClient(): Razorpay {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Razorpay keys are not configured',
        fieldErrors: {},
      });
    }
    if (!this.client) {
      this.client = new Razorpay({
        key_id: this.keyId(),
        key_secret: this.keySecret(),
      });
    }
    return this.client;
  }

  async createOrder(input: {
    amountPaise: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ orderId: string; amount: number; currency: string; receipt: string }> {
    const amount = Math.trunc(input.amountPaise);
    if (!Number.isFinite(amount) || amount < 100) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be at least 100 paise (₹1)',
        fieldErrors: { amount: ['minimum 100 paise'] },
      });
    }

    const currency = (input.currency ?? 'INR').toUpperCase();
    try {
      const order = (await this.getClient().orders.create({
        amount,
        currency,
        receipt: input.receipt.slice(0, 40),
        notes: input.notes,
      })) as RazorpayOrderResponse;

      return {
        orderId: order.id,
        amount: Number(order.amount),
        currency: order.currency,
        receipt: order.receipt ?? input.receipt,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Razorpay order creation failed';
      if (/auth|unauthorized|access denied/i.test(message)) {
        throw new UnauthorizedException({
          code: 'RAZORPAY_AUTH_FAILED',
          message: 'Razorpay authentication failed. Check API keys.',
          fieldErrors: {},
        });
      }
      throw new BadRequestException({
        code: 'RAZORPAY_ORDER_FAILED',
        message,
        fieldErrors: {},
      });
    }
  }

  verifyPaymentSignature(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const secret = this.keySecret();
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'PAYMENTS_NOT_CONFIGURED',
        message: 'Razorpay keys are not configured',
        fieldErrors: {},
      });
    }

    const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const provided = input.razorpaySignature?.trim() ?? '';
    if (!provided || expected.length !== provided.length) {
      return false;
    }
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }
}
