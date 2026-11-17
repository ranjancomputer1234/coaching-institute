import { ConfigService } from '@nestjs/config';
import { EntitlementState } from '@prisma/client';
import { PlatformService } from './platform.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DailyService } from './daily.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

describe('PlatformService.reconcileOrder', () => {
  const orderUpdate = jest.fn();
  const entitlementFindFirst = jest.fn();
  const entitlementCreate = jest.fn();
  const prisma = {
    order: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: { update: orderUpdate },
        entitlement: {
          findFirst: entitlementFindFirst,
          create: entitlementCreate,
        },
      }),
    ),
  };
  const audit = { write: jest.fn() };
  const config = {
    get: jest.fn(),
  } as unknown as ConfigService;
  const daily = {
    isConfigured: jest.fn().mockReturnValue(false),
  } as unknown as DailyService;

  const service = new PlatformService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    config,
    daily,
  );
  const actor = { userId: 'admin-1', email: 'admin@test.local' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks the order paid and grants a course entitlement from product.courseId', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      learnerId: 'learner-1',
      product: { courseId: 'course-1', sku: 'SKU-1' },
    });
    orderUpdate.mockResolvedValue({
      id: 'order-1',
      status: 'paid_manual',
      product: { courseId: 'course-1', sku: 'SKU-1' },
    });
    entitlementFindFirst.mockResolvedValue(null);
    entitlementCreate.mockResolvedValue({
      id: 'ent-1',
      courseId: 'course-1',
      state: EntitlementState.active,
      source: 'purchase',
    });

    const result = await service.reconcileOrder(
      'order-1',
      { externalReference: 'pay_abc123' },
      actor,
    );

    expect(result.accessGranted).toBe(true);
    expect(result.entitlement?.id).toBe('ent-1');
    expect(entitlementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          learnerId: 'learner-1',
          courseId: 'course-1',
          source: 'purchase',
          productKey: 'SKU-1',
          grantReason: 'order:order-1 ref:pay_abc123',
        }),
      }),
    );
  });

  it('does not create a second entitlement when one already exists for the order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      learnerId: 'learner-1',
      product: { courseId: 'course-1', sku: 'SKU-1' },
    });
    orderUpdate.mockResolvedValue({
      id: 'order-1',
      status: 'paid_manual',
      product: { courseId: 'course-1', sku: 'SKU-1' },
    });
    entitlementFindFirst.mockResolvedValue({
      id: 'ent-existing',
      courseId: 'course-1',
      state: EntitlementState.active,
      source: 'purchase',
    });

    const result = await service.reconcileOrder(
      'order-1',
      { externalReference: 'pay_abc123' },
      actor,
    );

    expect(result.accessGranted).toBe(true);
    expect(result.entitlement?.id).toBe('ent-existing');
    expect(entitlementCreate).not.toHaveBeenCalled();
  });

  it('reconciles without entitlement when product has no courseId', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-2',
      learnerId: 'learner-1',
      product: { courseId: null, sku: 'SKU-2' },
    });
    orderUpdate.mockResolvedValue({
      id: 'order-2',
      status: 'paid_manual',
      product: { courseId: null, sku: 'SKU-2' },
    });

    const result = await service.reconcileOrder(
      'order-2',
      { externalReference: 'pay_xyz' },
      actor,
    );

    expect(result.accessGranted).toBe(false);
    expect(result.entitlement).toBeNull();
    expect(entitlementCreate).not.toHaveBeenCalled();
  });
});
