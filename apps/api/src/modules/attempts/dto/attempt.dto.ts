import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAttemptDto {
  @IsString()
  testId!: string;

  @IsString()
  learnerId!: string;
}

export class SaveAnswerDto {
  @IsString()
  selectedOptionId!: string;
}

export class ReasonDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class PublishResultsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
