import { PaymentMethod } from '../models';
import { PaymentLifecycleStatus } from './payment-state.enum';

export interface PaymentRecord {
  paymentId: string;
  orderId: string;
  userId: string;
  method: PaymentMethod;
  status: PaymentLifecycleStatus;
  amount: number;
  currency: 'INR';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  failureReason?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CheckoutPaymentInput {
  orderId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  userName: string;
  userPhone: string;
}

export interface CheckoutPaymentResult {
  orderId: string;
  completed: boolean;
  paymentId?: string;
}

/** Future webhook payload shape. */
export interface PaymentWebhookPayload {
  provider: 'razorpay';
  event: string;
  orderId: string;
  paymentId: string;
  raw: Record<string, unknown>;
}
