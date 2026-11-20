import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditSeverity, EntitlementState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from './payments.dto';
import { RazorpayService } from './razorpay.service';

type Actor = { userId: string; email?: string };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly razorpay: RazorpayService,
  ) {}

  config() {
    return {
      configured: this.razorpay.isConfigured(),
      keyId: this.razorpay.isConfigured() ? this.razorpay.keyId() : null,
      provider: 'razorpay',
    };
  }

  async createCheckoutOrder(dto: CreateRazorpayOrderDto, actor?: Actor) {
    if (!dto.orderId && dto.amount == null) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Provide orderId or amount (paise)',
        fieldErrors: { orderId: ['required without amount'] },
      });
    }

    let instituteOrderId: string | undefined;
    let amountPaise = dto.amount ?? 0;
    let currency = (dto.currency ?? 'INR').toUpperCase();
    let receipt = dto.receipt?.trim() || `rcpt_${Date.now()}`;
    let notes: Record<string, string> | undefined;

    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: { product: true },
      });
      if (!order) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Order not found',
          fieldErrors: {},
        });
      }
      if (order.status === 'paid' || order.status === 'paid_manual' || order.status === 'paid_razorpay') {
        throw new BadRequestException({
          code: 'ORDER_ALREADY_PAID',
          message: 'This order is already paid',
          fieldErrors: {},
        });
      }
      if (order.amountPaise < 100) {
        throw new BadRequestException({
          code: 'INVALID_AMOUNT',
          message: 'Order amount must be at least 100 paise',
          fieldErrors: { amount: ['minimum 100 paise'] },
        });
      }
      instituteOrderId = order.id;
      amountPaise = order.amountPaise;
      currency = order.currency || 'INR';
      receipt = `ord_${order.id}`.slice(0, 40);
      notes = {
        instituteOrderId: order.id,
        productSku: order.product.sku,
        learnerId: order.learnerId,
      };
    }

    const created = await this.razorpay.createOrder({
      amountPaise,
      currency,
      receipt,
      notes,
    });

    if (instituteOrderId) {
      await this.prisma.order.update({
        where: { id: instituteOrderId },
        data: {
          externalReference: created.orderId,
          providerStatus: 'razorpay_order_created',
          status: 'pending',
        },
      });
      if (actor) {
        await this.audit.write({
          actorId: actor.userId,
          actorDisplay: actor.email,
          action: 'payment.razorpay_order_create',
          resourceType: 'Order',
          resourceId: instituteOrderId,
          after: {
            razorpayOrderId: created.orderId,
            amountPaise: created.amount,
          },
        });
      }
    }

    return {
      order_id: created.orderId,
      amount: created.amount,
      currency: created.currency,
      key_id: this.razorpay.keyId(),
      instituteOrderId: instituteOrderId ?? null,
      receipt: created.receipt,
    };
  }

  async verifyPayment(dto: VerifyRazorpayPaymentDto, actor?: Actor) {
    const ok = this.razorpay.verifyPaymentSignature({
      razorpayOrderId: dto.razorpay_order_id,
      razorpayPaymentId: dto.razorpay_payment_id,
      razorpaySignature: dto.razorpay_signature,
    });

    if (!ok) {
      throw new BadRequestException({
        code: 'SIGNATURE_MISMATCH',
        message: 'Payment signature verification failed',
        fieldErrors: { razorpay_signature: ['invalid'] },
      });
    }

    let instituteOrder =
      (dto.orderId
        ? await this.prisma.order.findUnique({
            where: { id: dto.orderId },
            include: { product: true },
          })
        : null) ??
      (await this.prisma.order.findFirst({
        where: { externalReference: dto.razorpay_order_id },
        include: { product: true },
      }));

    if (!instituteOrder) {
      // Signature is valid but not linked to an institute order — still success for standalone tests.
      if (actor) {
        await this.audit.write({
          actorId: actor.userId,
          actorDisplay: actor.email,
          action: 'payment.razorpay_verified_standalone',
          resourceType: 'RazorpayPayment',
          resourceId: dto.razorpay_payment_id,
          after: {
            razorpayOrderId: dto.razorpay_order_id,
            razorpayPaymentId: dto.razorpay_payment_id,
          },
          severity: AuditSeverity.notice,
        });
      }
      return {
        success: true,
        verified: true,
        orderId: null,
        paymentId: dto.razorpay_payment_id,
        accessGranted: false,
      };
    }

    if (
      instituteOrder.status === 'paid' ||
      instituteOrder.status === 'paid_manual' ||
      instituteOrder.status === 'paid_razorpay'
    ) {
      return {
        success: true,
        verified: true,
        orderId: instituteOrder.id,
        paymentId: dto.razorpay_payment_id,
        accessGranted: false,
        alreadyPaid: true,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id: instituteOrder!.id },
        data: {
          status: 'paid_razorpay',
          externalReference: dto.razorpay_payment_id,
          providerStatus: 'razorpay_captured',
        },
        include: { product: true },
      });

      let entitlement: {
        id: string;
        courseId: string | null;
        state: EntitlementState;
      } | null = null;

      const courseId = instituteOrder!.product.courseId;
      if (courseId) {
        const orderMarker = `order:${instituteOrder!.id}`;
        const already = await tx.entitlement.findFirst({
          where: {
            learnerId: instituteOrder!.learnerId,
            courseId,
            state: EntitlementState.active,
            OR: [
              { grantReason: { contains: orderMarker } },
              {
                source: 'purchase',
                productKey: instituteOrder!.product.sku,
              },
            ],
          },
        });
        if (already) {
          entitlement = already;
        } else {
          entitlement = await tx.entitlement.create({
            data: {
              learnerId: instituteOrder!.learnerId,
              courseId,
              scopeKind: 'course',
              scopeRef: courseId,
              source: 'purchase',
              state: EntitlementState.active,
              productKey: instituteOrder!.product.sku,
              grantReason: `${orderMarker} razorpay:${dto.razorpay_payment_id}`,
              canDownload: true,
              canPreview: true,
            },
          });
        }
      }

      return { order: row, entitlement, accessGranted: Boolean(entitlement) };
    });

    if (actor) {
      await this.audit.write({
        actorId: actor.userId,
        actorDisplay: actor.email,
        action: 'payment.razorpay_verified',
        resourceType: 'Order',
        resourceId: result.order.id,
        after: {
          status: result.order.status,
          paymentId: dto.razorpay_payment_id,
          accessGranted: result.accessGranted,
          entitlementId: result.entitlement?.id ?? null,
        },
        severity: AuditSeverity.high,
      });
    }

    return {
      success: true,
      verified: true,
      orderId: result.order.id,
      paymentId: dto.razorpay_payment_id,
      accessGranted: result.accessGranted,
      entitlementId: result.entitlement?.id ?? null,
    };
  }
}
