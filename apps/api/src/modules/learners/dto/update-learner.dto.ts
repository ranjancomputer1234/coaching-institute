import { PartialType } from '@nestjs/mapped-types';
import { CreateLearnerDto } from './create-learner.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateLearnerDto extends PartialType(CreateLearnerDto) {
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
