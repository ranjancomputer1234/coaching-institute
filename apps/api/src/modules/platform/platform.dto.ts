import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EditorialKind } from '@prisma/client';

export class CreateEditorialDto {
  @IsEnum(EditorialKind)
  kind!: EditorialKind;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  pricing?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsString()
  byline?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  readingMinutes?: number;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  quizId?: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  modelAnswer?: string;

  @IsOptional()
  @IsString()
  entriesJson?: string;

  @IsOptional()
  @IsString()
  summaryChipsJson?: string;

  @IsOptional()
  @IsString()
  tagsJson?: string;

  @IsOptional()
  @IsString()
  highlightsJson?: string;
}

export class CreateContentCategoryDto {
  @IsEnum(EditorialKind)
  kind!: EditorialKind;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  pricing?: string;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateLiveClassDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  /** Custom subset of learners (searchable multi-select in admin). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  learnerIds?: string[];

  @IsOptional()
  @IsString()
  hostName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  key!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsString()
  channel?: string;
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  audienceRef?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  sku!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsInt()
  @Min(0)
  pricePaise!: number;

  @IsOptional()
  @IsString()
  courseId?: string;
}

export class CreateCouponDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountOffPaise?: number;
}

export class CreateOrderDto {
  @IsString()
  learnerId!: string;

  @IsString()
  productId!: string;
}

export class ReconcileOrderDto {
  @IsString()
  @MinLength(4)
  externalReference!: string;
}

export class CreateRefundDto {
  @IsString()
  orderId!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsInt()
  @Min(1)
  amountPaise!: number;
}

export class CreateSupportDto {
  @IsString()
  @MinLength(2)
  subject!: string;

  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsString()
  learnerId?: string;
}

export class UpdateSupportDto {
  @IsString()
  status!: string;
}

export class CreateLegalPageDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(12)
  locale?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;
}

export class UpdateLegalPageDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  body?: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;
}

export class UpsertSettingDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  value!: string;
}

export class CreateStaffDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  roleKey!: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  roleKey?: string;
}
