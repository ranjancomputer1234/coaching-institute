import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service';
import { ResourcesController } from './resources.controller';
import { MuxService } from './mux.service';
import { CloudinaryService } from './cloudinary.service';
import { ContentAccessModule } from '../content-access/content-access.module';

@Module({
  imports: [ContentAccessModule],
  controllers: [ResourcesController],
  providers: [ResourcesService, MuxService, CloudinaryService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
