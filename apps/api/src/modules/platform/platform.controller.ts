import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EditorialKind } from '@prisma/client';
import { PlatformService } from './platform.service';
import {
  CreateCampaignDto,
  CreateCouponDto,
  CreateEditorialDto,
  CreateLiveClassDto,
  CreateOrderDto,
  CreateProductDto,
  CreateRefundDto,
  CreateSupportDto,
  CreateTemplateDto,
  ReconcileOrderDto,
  UpdateSupportDto,
  UpsertSettingDto,
} from './platform.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  PermissionsGuard,
  RequirePermissions,
} from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type Actor = { userId: string; email?: string };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('editorial')
  @RequirePermissions('content.edit')
  listEditorial(@Query('kind') kind?: EditorialKind) {
    return this.platform.listEditorial(kind);
  }

  @Post('editorial')
  @RequirePermissions('content.create')
  createEditorial(@Body() dto: CreateEditorialDto, @CurrentUser() user: Actor) {
    return this.platform.createEditorial(dto, user);
  }

  @Post('editorial/:id/publish')
  @RequirePermissions('content.publish')
  publishEditorial(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.publishEditorial(id, user);
  }

  @Get('live-classes')
  @RequirePermissions('live.schedule')
  listLive() {
    return this.platform.listLiveClasses();
  }

  @Post('live-classes')
  @RequirePermissions('live.schedule')
  createLive(@Body() dto: CreateLiveClassDto, @CurrentUser() user: Actor) {
    return this.platform.createLiveClass(dto, user);
  }

  @Post('live-classes/:id/schedule')
  @RequirePermissions('live.schedule')
  scheduleLive(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.scheduleLiveClass(id, user);
  }

  @Get('notification-templates')
  @RequirePermissions('notifications.send_single')
  listTemplates() {
    return this.platform.listTemplates();
  }

  @Post('notification-templates')
  @RequirePermissions('notifications.send_single')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: Actor) {
    return this.platform.createTemplate(dto, user);
  }

  @Get('notifications')
  @RequirePermissions('notifications.send_single')
  listCampaigns() {
    return this.platform.listCampaigns();
  }

  @Post('notifications')
  @RequirePermissions('notifications.send_single')
  createCampaign(@Body() dto: CreateCampaignDto, @CurrentUser() user: Actor) {
    return this.platform.createCampaign(dto, user);
  }

  @Post('notifications/:id/send')
  @RequirePermissions('notifications.send_bulk')
  send(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.sendCampaign(id, user);
  }

  @Get('products')
  @RequirePermissions('payments.read')
  listProducts() {
    return this.platform.listProducts();
  }

  @Post('products')
  @RequirePermissions('payments.read')
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() user: Actor) {
    return this.platform.createProduct(dto, user);
  }

  @Get('coupons')
  @RequirePermissions('payments.read')
  listCoupons() {
    return this.platform.listCoupons();
  }

  @Post('coupons')
  @RequirePermissions('payments.read')
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: Actor) {
    return this.platform.createCoupon(dto, user);
  }

  @Get('orders')
  @RequirePermissions('payments.read')
  listOrders() {
    return this.platform.listOrders();
  }

  @Post('orders')
  @RequirePermissions('payments.read')
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: Actor) {
    return this.platform.createOrder(dto, user);
  }

  @Post('orders/:id/reconcile')
  @RequirePermissions('payments.refund_approve')
  reconcile(
    @Param('id') id: string,
    @Body() dto: ReconcileOrderDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.reconcileOrder(id, dto, user);
  }

  @Get('refunds')
  @RequirePermissions('payments.read')
  listRefunds() {
    return this.platform.listRefunds();
  }

  @Post('refunds')
  @RequirePermissions('payments.refund_request')
  createRefund(@Body() dto: CreateRefundDto, @CurrentUser() user: Actor) {
    return this.platform.createRefund(dto, user);
  }

  @Post('refunds/:id/approve')
  @RequirePermissions('payments.refund_approve')
  approveRefund(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.approveRefund(id, user);
  }

  @Get('support-cases')
  @RequirePermissions('users.read')
  listSupport() {
    return this.platform.listSupport();
  }

  @Post('support-cases')
  @RequirePermissions('users.update')
  createSupport(@Body() dto: CreateSupportDto, @CurrentUser() user: Actor) {
    return this.platform.createSupport(dto, user);
  }

  @Patch('support-cases/:id')
  @RequirePermissions('users.update')
  updateSupport(
    @Param('id') id: string,
    @Body() dto: UpdateSupportDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateSupport(id, dto, user);
  }

  @Get('settings')
  @RequirePermissions('settings.manage')
  settings() {
    return this.platform.settings();
  }

  @Post('settings')
  @RequirePermissions('settings.manage')
  upsertSetting(@Body() dto: UpsertSettingDto, @CurrentUser() user: Actor) {
    return this.platform.upsertSetting(dto, user);
  }

  @Get('reports/summary')
  @RequirePermissions('reports.read')
  reports() {
    return this.platform.reports();
  }
}
