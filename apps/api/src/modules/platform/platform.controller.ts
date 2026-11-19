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
  CreateContentCategoryDto,
  CreateCouponDto,
  CreateEditorialDto,
  CreateLegalPageDto,
  CreateLiveClassDto,
  CreateOrderDto,
  CreateProductDto,
  CreateRefundDto,
  CreateSupportDto,
  CreateTemplateDto,
  ReconcileOrderDto,
  UpdateCampaignDto,
  UpdateContentCategoryDto,
  UpdateCouponDto,
  UpdateEditorialDto,
  UpdateLegalPageDto,
  UpdateLiveClassDto,
  UpdateProductDto,
  UpdateSupportDto,
  UpdateTemplateDto,
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

  @Get('editorial/:id')
  @RequirePermissions('content.edit')
  getEditorial(@Param('id') id: string) {
    return this.platform.getEditorial(id);
  }

  @Post('editorial')
  @RequirePermissions('content.create')
  createEditorial(@Body() dto: CreateEditorialDto, @CurrentUser() user: Actor) {
    return this.platform.createEditorial(dto, user);
  }

  @Patch('editorial/:id')
  @RequirePermissions('content.edit')
  updateEditorial(
    @Param('id') id: string,
    @Body() dto: UpdateEditorialDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateEditorial(id, dto, user);
  }

  @Post('editorial/:id/publish')
  @RequirePermissions('content.publish')
  publishEditorial(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.publishEditorial(id, user);
  }

  @Post('editorial/:id/archive')
  @RequirePermissions('content.archive')
  archiveEditorial(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.archiveEditorial(id, user);
  }

  @Get('content-categories')
  @RequirePermissions('content.edit')
  listContentCategories(@Query('kind') kind?: EditorialKind) {
    return this.platform.listContentCategories(kind);
  }

  @Get('content-categories/:id')
  @RequirePermissions('content.edit')
  getContentCategory(@Param('id') id: string) {
    return this.platform.getContentCategory(id);
  }

  @Post('content-categories')
  @RequirePermissions('content.create')
  createContentCategory(
    @Body() dto: CreateContentCategoryDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.createContentCategory(dto, user);
  }

  @Patch('content-categories/:id')
  @RequirePermissions('content.edit')
  updateContentCategory(
    @Param('id') id: string,
    @Body() dto: UpdateContentCategoryDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateContentCategory(id, dto, user);
  }

  @Post('content-categories/:id/publish')
  @RequirePermissions('content.publish')
  publishContentCategory(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.publishContentCategory(id, user);
  }

  @Post('content-categories/:id/archive')
  @RequirePermissions('content.archive')
  archiveContentCategory(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.archiveContentCategory(id, user);
  }

  @Get('live-classes')
  @RequirePermissions('live.schedule')
  listLive() {
    return this.platform.listLiveClasses();
  }

  @Get('live-classes/:id')
  @RequirePermissions('live.schedule')
  getLive(@Param('id') id: string) {
    return this.platform.getLiveClass(id);
  }

  @Post('live-classes')
  @RequirePermissions('live.schedule')
  createLive(@Body() dto: CreateLiveClassDto, @CurrentUser() user: Actor) {
    return this.platform.createLiveClass(dto, user);
  }

  @Patch('live-classes/:id')
  @RequirePermissions('live.schedule')
  updateLive(
    @Param('id') id: string,
    @Body() dto: UpdateLiveClassDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateLiveClass(id, dto, user);
  }

  @Post('live-classes/:id/schedule')
  @RequirePermissions('live.schedule')
  scheduleLive(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.scheduleLiveClass(id, user);
  }

  @Post('live-classes/:id/cancel')
  @RequirePermissions('live.schedule')
  cancelLive(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.cancelLiveClass(id, user);
  }

  @Get('notification-templates')
  @RequirePermissions('notifications.send_single')
  listTemplates() {
    return this.platform.listTemplates();
  }

  @Get('notification-templates/:id')
  @RequirePermissions('notifications.send_single')
  getTemplate(@Param('id') id: string) {
    return this.platform.getTemplate(id);
  }

  @Post('notification-templates')
  @RequirePermissions('notifications.send_single')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: Actor) {
    return this.platform.createTemplate(dto, user);
  }

  @Patch('notification-templates/:id')
  @RequirePermissions('notifications.send_single')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateTemplate(id, dto, user);
  }

  @Get('notifications')
  @RequirePermissions('notifications.send_single')
  listCampaigns() {
    return this.platform.listCampaigns();
  }

  @Get('notifications/:id')
  @RequirePermissions('notifications.send_single')
  getCampaign(@Param('id') id: string) {
    return this.platform.getCampaign(id);
  }

  @Post('notifications')
  @RequirePermissions('notifications.send_single')
  createCampaign(@Body() dto: CreateCampaignDto, @CurrentUser() user: Actor) {
    return this.platform.createCampaign(dto, user);
  }

  @Patch('notifications/:id')
  @RequirePermissions('notifications.send_single')
  updateCampaign(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateCampaign(id, dto, user);
  }

  @Post('notifications/:id/send')
  @RequirePermissions('notifications.send_bulk')
  send(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.sendCampaign(id, user);
  }

  @Post('notifications/:id/delete')
  @RequirePermissions('notifications.send_single')
  deleteCampaign(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.deleteCampaign(id, user);
  }

  @Get('products')
  @RequirePermissions('payments.read')
  listProducts() {
    return this.platform.listProducts();
  }

  @Get('products/:id')
  @RequirePermissions('payments.read')
  getProduct(@Param('id') id: string) {
    return this.platform.getProduct(id);
  }

  @Post('products')
  @RequirePermissions('payments.read')
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() user: Actor) {
    return this.platform.createProduct(dto, user);
  }

  @Patch('products/:id')
  @RequirePermissions('payments.read')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateProduct(id, dto, user);
  }

  @Post('products/:id/archive')
  @RequirePermissions('payments.read')
  archiveProduct(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.archiveProduct(id, user);
  }

  @Get('coupons')
  @RequirePermissions('payments.read')
  listCoupons() {
    return this.platform.listCoupons();
  }

  @Get('coupons/:id')
  @RequirePermissions('payments.read')
  getCoupon(@Param('id') id: string) {
    return this.platform.getCoupon(id);
  }

  @Post('coupons')
  @RequirePermissions('payments.read')
  createCoupon(@Body() dto: CreateCouponDto, @CurrentUser() user: Actor) {
    return this.platform.createCoupon(dto, user);
  }

  @Patch('coupons/:id')
  @RequirePermissions('payments.read')
  updateCoupon(
    @Param('id') id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateCoupon(id, dto, user);
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

  @Get('legal')
  listLegal() {
    return this.platform.listLegalPages();
  }

  @Post('legal')
  @RequirePermissions('content.create')
  createLegal(@Body() dto: CreateLegalPageDto, @CurrentUser() user: Actor) {
    return this.platform.createLegalPage(dto, user);
  }

  @Patch('legal/:id')
  @RequirePermissions('content.edit')
  updateLegal(
    @Param('id') id: string,
    @Body() dto: UpdateLegalPageDto,
    @CurrentUser() user: Actor,
  ) {
    return this.platform.updateLegalPage(id, dto, user);
  }

  @Post('legal/:id/publish')
  @RequirePermissions('content.publish')
  publishLegal(@Param('id') id: string, @CurrentUser() user: Actor) {
    return this.platform.publishLegalPage(id, user);
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
