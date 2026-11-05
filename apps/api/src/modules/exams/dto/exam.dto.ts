import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CourseCommercialMode } from '@prisma/client';

export class CreateExamDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CourseCommercialMode)
  commercialMode?: CourseCommercialMode;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsString()
  themeKey?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  learnerCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedExams?: string[];
}

export class UpdateExamDto extends CreateExamDto {}
