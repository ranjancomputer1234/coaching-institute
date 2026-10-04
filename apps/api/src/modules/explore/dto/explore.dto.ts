import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ExploreCategory } from '@prisma/client';

export class CreateExploreSectionDto {
  @IsString()
  @MinLength(2)
  slug!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;

  @IsString()
  targetKind!: string;

  @IsString()
  targetRef!: string;

  @IsOptional()
  @IsString()
  pricingFilter?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  homeVisible?: boolean;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsString()
  themeKey?: string;
}

export class UpdateExploreSectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;

  @IsOptional()
  @IsString()
  targetKind?: string;

  @IsOptional()
  @IsString()
  targetRef?: string;

  @IsOptional()
  @IsString()
  pricingFilter?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  homeVisible?: boolean;

  @IsOptional()
  @IsString()
  iconKey?: string;

  @IsOptional()
  @IsString()
  themeKey?: string;
}

export class ReorderExploreDto {
  @IsString({ each: true })
  orderedIds!: string[];
}
