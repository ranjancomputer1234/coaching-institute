import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
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
