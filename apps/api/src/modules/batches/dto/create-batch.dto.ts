import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  /** Optional custom roster — pick specific learners for this batch. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  learnerIds?: string[];
}
