import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CreateRazorpayOrderDto, VerifyRazorpayPaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

type Actor = { userId: string; email?: string };

/**
 * Razorpay Standard Checkout endpoints.
 * Paths (global prefix `api`):
 * - GET  /api/payments/config
 * - POST /api/payments/create-order
 * - POST /api/payments/verify-payment
 * Aliases also mounted at /api/create-order and /api/verify-payment.
 */
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments/config')
  config() {
    return this.payments.config();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('payments.read')
  @Post('payments/create-order')
  createOrder(
    @Body() dto: CreateRazorpayOrderDto,
    @CurrentUser() user: Actor,
  ) {
    return this.payments.createCheckoutOrder(dto, user);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('payments.read')
  @Post('payments/verify-payment')
  verifyPayment(
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentUser() user: Actor,
  ) {
    return this.payments.verifyPayment(dto, user);
  }

  /** Spec alias: POST /api/create-order */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('payments.read')
  @Post('create-order')
  createOrderAlias(
    @Body() dto: CreateRazorpayOrderDto,
    @CurrentUser() user: Actor,
  ) {
    return this.payments.createCheckoutOrder(dto, user);
  }

  /** Spec alias: POST /api/verify-payment */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('payments.read')
  @Post('verify-payment')
  verifyPaymentAlias(
    @Body() dto: VerifyRazorpayPaymentDto,
    @CurrentUser() user: Actor,
  ) {
    return this.payments.verifyPayment(dto, user);
  }
}
