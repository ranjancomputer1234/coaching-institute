import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

export class IssueDocumentDto {
  @IsString()
  learnerId!: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  serial?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;

  @IsOptional()
  @IsString()
  pdfSha256?: string;

  @IsOptional()
  @IsObject()
  snapshot?: Record<string, unknown>;
}

export class RevokeDocumentDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  key!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsOptional()
  @IsString()
  locale?: string;
}
