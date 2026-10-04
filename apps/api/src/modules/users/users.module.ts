import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { StaffController } from './staff.controller';

@Module({
  controllers: [StaffController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
