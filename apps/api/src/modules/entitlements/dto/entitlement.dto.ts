import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EntitlementState } from '@prisma/client';

export class GrantEntitlementDto {
  @IsString()
  learnerId!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  scopeKind?: string;

  @IsOptional()
  @IsString()
  scopeRef?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsBoolean()
  canDownload?: boolean;

  @IsOptional()
  @IsBoolean()
  canPreview?: boolean;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  grantReason?: string;
}

export class RevokeEntitlementDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsEnum(EntitlementState)
  state?: EntitlementState;
}
