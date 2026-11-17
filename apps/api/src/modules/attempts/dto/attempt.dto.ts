import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

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

/** Learner answer body. Either field is accepted; at least one is required. */
export class SaveLearnerAnswerDto {
  @ValidateIf((o: SaveLearnerAnswerDto) => !o.optionId)
  @IsString()
  @IsNotEmpty()
  selectedOptionId?: string;

  @ValidateIf((o: SaveLearnerAnswerDto) => !o.selectedOptionId)
  @IsString()
  @IsNotEmpty()
  optionId?: string;
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
