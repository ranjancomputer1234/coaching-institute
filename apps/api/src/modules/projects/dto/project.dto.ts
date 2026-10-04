import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  semesterId?: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateSubmissionDto {
  @IsString()
  learnerId!: string;

  @IsOptional()
  @IsString()
  textBody?: string;
}

export class ReviewSubmissionDto {
  @IsString()
  @MinLength(3)
  learnerFeedback!: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}

export class CreateSemesterDto {
  @IsString()
  courseId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsInt()
  index!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SemesterDecisionDto {
  @IsOptional()
  @IsString()
  learnerFeedback?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
