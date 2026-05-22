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

import { RazorpaySuccess } from '../services/razorpay.service';

export interface OpenRazorpayCheckoutInput {
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  onSuccess: (response: RazorpaySuccess) => void;
}
