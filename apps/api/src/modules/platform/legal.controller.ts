import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlatformService } from './platform.service';

/** Published legal notices. No staff sign-in required. */
@Controller('legal')
export class LegalController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  list(@Query('locale') locale?: string) {
    return this.platform.listPublicLegal(locale);
  }

  @Get(':slug')
  one(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.platform.getPublicLegal(slug, locale);
  }
}
