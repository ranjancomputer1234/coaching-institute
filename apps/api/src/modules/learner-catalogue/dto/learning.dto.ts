import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class LessonProgressDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  positionSeconds?: number;
}
