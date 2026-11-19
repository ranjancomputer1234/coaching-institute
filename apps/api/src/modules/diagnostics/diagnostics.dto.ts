import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class DiagnosticsRunDto {
  /** Optional inbox for live email delivery test. Defaults to EMAIL_FROM_ADDRESS. */
  @IsOptional()
  @IsEmail()
  toEmail?: string;

  /** When true, skip actual Brevo/console send (config checks only). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;
}

export class EmailProbeDto {
  @IsEmail()
  toEmail!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
