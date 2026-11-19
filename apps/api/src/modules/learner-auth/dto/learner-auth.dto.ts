import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LearnerLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class LearnerRegisterDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;
}

export class LearnerUpdateMeDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

export class VerifyChallengeDto {
  @IsString()
  @Length(4, 12)
  code!: string;
}

export class PasswordForgotDto {
  @IsEmail()
  email!: string;
}

export class PasswordVerifyDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Length(4, 12)
  code!: string;
}

export class PasswordResetDto {
  @IsString()
  resetToken!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class ResendVerificationDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
