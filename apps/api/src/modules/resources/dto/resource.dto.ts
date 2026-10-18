import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { DrmScheme, ResourceKind } from '@prisma/client';

export class CreateResourceDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsEnum(ResourceKind)
  kind!: ResourceKind;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  byteSize?: number;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  mediaAssetId?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  checksumSha256?: string;

  @IsOptional()
  @IsString()
  encryptionAlgo?: string;

  @IsOptional()
  @IsString()
  packagingFormat?: string;

  @IsOptional()
  @IsEnum(DrmScheme)
  drmScheme?: DrmScheme;

  @IsOptional()
  @IsString()
  drmContentId?: string;

  @IsOptional()
  @IsString()
  licenseServiceUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offlinePeriodSeconds?: number;

  @IsOptional()
  @IsBoolean()
  downloadable?: boolean;

  @IsOptional()
  @IsBoolean()
  previewAllowed?: boolean;
}

/** Admin asks the API for a Mux direct-upload URL, then PUTs the file straight to Mux. */
export class CreateVideoUploadDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  byteSize?: number;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;
}

export class DownloadAuthorizationDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  installationId?: string;
}
