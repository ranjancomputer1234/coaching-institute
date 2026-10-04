import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { TestMode } from '@prisma/client';

export class CreateTestDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TestMode)
  mode?: TestMode;

  @IsOptional()
  @IsString()
  courseId?: string;

  @IsOptional()
  @IsString()
  semesterId?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  passThreshold?: number;

  @IsOptional()
  @IsBoolean()
  negativeMarking?: boolean;

  @IsOptional()
  @IsInt()
  attemptLimit?: number;

  @IsOptional()
  @IsString()
  resultPolicy?: string;
}

export class UpdateTestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TestMode)
  mode?: TestMode;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  passThreshold?: number;

  @IsOptional()
  @IsBoolean()
  negativeMarking?: boolean;

  @IsOptional()
  @IsInt()
  attemptLimit?: number;

  @IsOptional()
  @IsString()
  resultPolicy?: string;
}

export class SetTestQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds!: string[];
}
