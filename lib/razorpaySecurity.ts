import crypto from 'crypto';
import Razorpay from 'razorpay';
import { ApiError, requireEnv } from './serverApi';

export function getRazorpayKeyId(): string {
    return requireEnv('VITE_RAZORPAY_KEY_ID');
}

export function getRazorpaySecret(): string {
    return requireEnv('RAZORPAY_KEY_SECRET');
}

export function createRazorpayClient() {
    return new Razorpay({
        key_id: getRazorpayKeyId(),
        key_secret: getRazorpaySecret(),
    });
}

export function timingSafeEqualHex(actual: string, expected: string): boolean {
    const actualBuffer = Buffer.from(actual, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (actualBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyOrderSignature(orderId: string, paymentId: string, signature: string): void {
    const expected = crypto
        .createHmac('sha256', getRazorpaySecret())
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    if (!timingSafeEqualHex(expected, signature)) {
        throw new ApiError(400, 'Invalid signature');
    }
}

export function verifySubscriptionSignature(subscriptionId: string, paymentId: string, signature: string): void {
    const expected = crypto
        .createHmac('sha256', getRazorpaySecret())
        .update(`${paymentId}|${subscriptionId}`)
        .digest('hex');

    if (!timingSafeEqualHex(expected, signature)) {
        throw new ApiError(400, 'Invalid signature');
    }
}

export function verifyWebhookSignature(rawBody: string, signature: string): void {
    const expected = crypto
        .createHmac('sha256', requireEnv('RAZORPAY_WEBHOOK_SECRET'))
        .update(rawBody)
        .digest('hex');

    if (!timingSafeEqualHex(expected, signature)) {
        throw new ApiError(400, 'Invalid signature');
    }
}

export function requireRazorpayCapturedPayment(payment: any): void {
    if (!payment || payment.status !== 'captured') {
        throw new ApiError(409, 'Payment is not captured yet');
    }
}

export function assertRazorpayAmount(payment: any, expectedAmountInr: number, expectedCurrency = 'INR'): void {
    const expectedAmountPaise = expectedAmountInr * 100;
    if (payment.amount !== expectedAmountPaise || payment.currency !== expectedCurrency) {
        throw new ApiError(400, 'Payment amount or currency mismatch');
    }
}
