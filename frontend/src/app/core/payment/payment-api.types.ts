export interface CreateOrderRequest {
  amount: number;
  currency?: string;
  receipt?: string;
}

export interface CreateOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderId: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
}

import { RazorpaySuccess } from '../services/razorpay.service';

export interface OpenRazorpayCheckoutInput {
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  onSuccess: (response: RazorpaySuccess) => void;
}
