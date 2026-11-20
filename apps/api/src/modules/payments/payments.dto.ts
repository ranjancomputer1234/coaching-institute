import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRazorpayOrderDto {
  /** Existing pending institute order to charge. Prefer this for real purchases. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  orderId?: string;

  /** Standalone amount in paise when no institute order is linked (min 100). */
  @IsOptional()
  @IsInt()
  @Min(100)
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  receipt?: string;
}

export class VerifyRazorpayPaymentDto {
  @IsString()
  @MinLength(2)
  razorpay_order_id!: string;

  @IsString()
  @MinLength(2)
  razorpay_payment_id!: string;

  @IsString()
  @MinLength(2)
  razorpay_signature!: string;

  /** Optional institute order id so we can mark paid + grant access. */
  @IsOptional()
  @IsString()
  orderId?: string;
}
