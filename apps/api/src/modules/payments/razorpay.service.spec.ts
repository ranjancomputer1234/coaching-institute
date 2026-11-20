import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService', () => {
  const secret = 'test_secret';
  const config = {
    get: (key: string) => {
      if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_key';
      if (key === 'RAZORPAY_KEY_SECRET') return secret;
      return undefined;
    },
  } as unknown as ConfigService;

  it('rejects amounts below 100 paise', async () => {
    const service = new RazorpayService(config);
    await expect(
      service.createOrder({ amountPaise: 99, receipt: 'r1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies a matching HMAC signature', () => {
    const service = new RazorpayService(config);
    const orderId = 'order_ABC';
    const paymentId = 'pay_XYZ';
    const signature = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      service.verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      }),
    ).toBe(true);
  });

  it('rejects a mismatched signature', () => {
    const service = new RazorpayService(config);
    expect(
      service.verifyPaymentSignature({
        razorpayOrderId: 'order_ABC',
        razorpayPaymentId: 'pay_XYZ',
        razorpaySignature: 'deadbeef',
      }),
    ).toBe(false);
  });
});
