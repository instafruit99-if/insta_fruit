const crypto = require('crypto');
const admin = require('firebase-admin');
const { getRazorpay } = require('../config/razorpay');
const { getFirestore } = require('../config/firestore');
const { razorpayKeySecret } = require('../config/env');

function validateAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

async function createOrder(req, res) {
  try {
    const { amount, currency = 'INR', receipt } = req.body ?? {};

    if (!validateAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Valid positive amount is required',
      });
    }

    if (typeof currency !== 'string' || currency.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid currency is required',
      });
    }

    const orderReceipt =
      typeof receipt === 'string' && receipt.trim().length > 0
        ? receipt.trim()
        : `rcpt_${Date.now()}`;

    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: currency.trim().toUpperCase(),
      receipt: orderReceipt,
    });

    res.status(200).json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      receipt: razorpayOrder.receipt,
    });
  } catch (error) {
    console.error('Razorpay create order failed:', error);
    res.status(500).json({
      success: false,
      message: error.message ?? 'Failed to create Razorpay order',
    });
  }
}

function validateVerifyPayload(body) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } =
    body ?? {};
  if (
    typeof razorpayOrderId !== 'string' ||
    !razorpayOrderId.trim() ||
    typeof razorpayPaymentId !== 'string' ||
    !razorpayPaymentId.trim() ||
    typeof razorpaySignature !== 'string' ||
    !razorpaySignature.trim() ||
    typeof orderId !== 'string' ||
    !orderId.trim()
  ) {
    return null;
  }
  return {
    razorpayOrderId: razorpayOrderId.trim(),
    razorpayPaymentId: razorpayPaymentId.trim(),
    razorpaySignature: razorpaySignature.trim(),
    orderId: orderId.trim(),
  };
}

async function verifyPayment(req, res) {
  try {
    if (!razorpayKeySecret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay secret is not configured',
      });
    }

    const payload = validateVerifyPayload(req.body);
    if (!payload) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification payload',
      });
    }

    const expected = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${payload.razorpayOrderId}|${payload.razorpayPaymentId}`)
      .digest('hex');

    if (expected !== payload.razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    const db = getFirestore();
    const paymentRef = db.collection('payments').doc(payload.razorpayOrderId);
    const orderRef = db.collection('orders').doc(payload.orderId);

    const [paymentSnap, orderSnap] = await Promise.all([
      paymentRef.get(),
      orderRef.get(),
    ]);

    if (!paymentSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
      });
    }

    if (!orderSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const payment = paymentSnap.data();
    if (payment.orderId !== payload.orderId) {
      return res.status(400).json({
        success: false,
        message: 'Payment does not match order',
      });
    }

    const batch = db.batch();
    batch.update(paymentRef, {
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature,
      status: 'success',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(orderRef, {
      paymentStatus: 'success',
      paymentId: payload.razorpayPaymentId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Razorpay verify payment failed:', error);
    const message = error.message ?? 'Payment verification failed';
    const isFirebaseConfig =
      message.includes('service account') || message.includes('Firebase');
    res.status(isFirebaseConfig ? 503 : 500).json({
      success: false,
      message: isFirebaseConfig
        ? 'Firebase is not configured on the backend. Add service-account.json (see SETUP.md).'
        : message,
    });
  }
}

module.exports = {
  createOrder,
  verifyPayment,
};
