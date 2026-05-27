const crypto = require('crypto');
const admin = require('firebase-admin');
const { getRazorpay } = require('../config/razorpay');
const { getFirestore } = require('../config/firestore');
const { razorpayKeySecret, razorpayWebhookSecret } = require('../config/env');

function validateOrderId(orderId) {
  return typeof orderId === 'string' && orderId.trim().length > 0;
}

function validateAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0;
}

function verifyWebhookSignature(rawBody, signature) {
  if (!razorpayWebhookSecret || typeof signature !== 'string' || !signature.trim()) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');
  return expected === signature.trim();
}

function getPaymentEntity(body) {
  const entity = body?.payload?.payment?.entity;
  if (
    !entity ||
    typeof entity.id !== 'string' ||
    !entity.id.trim() ||
    typeof entity.order_id !== 'string' ||
    !entity.order_id.trim()
  ) {
    return null;
  }
  return {
    razorpayPaymentId: entity.id.trim(),
    razorpayOrderId: entity.order_id.trim(),
  };
}

async function markPaymentSuccess(db, params) {
  const paymentRef = db.collection('payments').doc(params.razorpayOrderId);
  const orderRef = db.collection('orders').doc(params.orderId);
  const batch = db.batch();
  batch.update(paymentRef, {
    razorpayPaymentId: params.razorpayPaymentId,
    ...(params.razorpaySignature
      ? { razorpaySignature: params.razorpaySignature }
      : {}),
    status: 'success',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(params.webhookEventId
      ? { lastWebhookEventId: params.webhookEventId }
      : {}),
  });
  batch.update(orderRef, {
    paymentStatus: 'success',
    paymentId: params.razorpayPaymentId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

async function markPaymentFailed(db, params) {
  const paymentRef = db.collection('payments').doc(params.razorpayOrderId);
  const orderRef = db.collection('orders').doc(params.orderId);
  const batch = db.batch();
  batch.update(paymentRef, {
    razorpayPaymentId: params.razorpayPaymentId,
    status: 'failed',
    failureReason: params.reason ?? 'Payment failed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(params.webhookEventId
      ? { lastWebhookEventId: params.webhookEventId }
      : {}),
  });
  batch.update(orderRef, {
    paymentStatus: 'failed',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

async function createOrder(req, res) {
  try {
    const { orderId } = req.body ?? {};

    if (!validateOrderId(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid orderId is required',
      });
    }

    const db = getFirestore();
    const orderRef = db.collection('orders').doc(orderId.trim());
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderSnap.data();

    if (order.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    if (order.paymentStatus === 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed',
      });
    }

    const amount = order.total;
    if (!validateAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order total',
      });
    }

    const razorpay = getRazorpay();
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: orderId.trim(),
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
    const order = orderSnap.data();

    if (order.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    if (payment.orderId !== payload.orderId) {
      return res.status(400).json({
        success: false,
        message: 'Payment does not match order',
      });
    }

    if (order.paymentStatus === 'success' || payment.status === 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed',
      });
    }

    await markPaymentSuccess(db, {
      razorpayOrderId: payload.razorpayOrderId,
      orderId: payload.orderId,
      razorpayPaymentId: payload.razorpayPaymentId,
      razorpaySignature: payload.razorpaySignature,
    });

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

async function handleWebhook(req, res) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'];
    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ success: false, message: 'Invalid webhook body' });
    }

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[webhook] Invalid signature');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }

    const event = body?.event;
    if (event !== 'payment.captured' && event !== 'payment.failed') {
      return res.status(200).json({ success: true, message: 'Event ignored' });
    }

    const paymentEntity = getPaymentEntity(body);
    if (!paymentEntity) {
      console.warn('[webhook] Missing payment entity', event);
      return res.status(200).json({ success: true, message: 'No payment entity' });
    }

    const db = getFirestore();
    const paymentRef = db.collection('payments').doc(paymentEntity.razorpayOrderId);
    const paymentSnap = await paymentRef.get();

    if (!paymentSnap.exists) {
      console.warn('[webhook] Payment record not found', paymentEntity.razorpayOrderId);
      return res.status(200).json({ success: true, message: 'Payment record not found' });
    }

    const payment = paymentSnap.data();
    const orderId = payment.orderId;
    if (typeof orderId !== 'string' || !orderId.trim()) {
      console.warn('[webhook] Payment missing orderId', paymentEntity.razorpayOrderId);
      return res.status(200).json({ success: true, message: 'Order link missing' });
    }

    if (
      typeof eventId === 'string' &&
      eventId.trim() &&
      payment.lastWebhookEventId === eventId.trim()
    ) {
      console.log('[webhook] Duplicate ignored', event, orderId.trim());
      return res.status(200).json({ success: true, message: 'Duplicate webhook' });
    }

    const orderRef = db.collection('orders').doc(orderId.trim());
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      console.warn('[webhook] Order not found', orderId.trim());
      return res.status(200).json({ success: true, message: 'Order not found' });
    }

    const order = orderSnap.data();

    if (event === 'payment.captured') {
      if (order.paymentStatus === 'success' || payment.status === 'success') {
        console.log('[webhook] Already success', orderId.trim());
        return res.status(200).json({ success: true, message: 'Already processed' });
      }

      await markPaymentSuccess(db, {
        razorpayOrderId: paymentEntity.razorpayOrderId,
        orderId: orderId.trim(),
        razorpayPaymentId: paymentEntity.razorpayPaymentId,
        webhookEventId: typeof eventId === 'string' ? eventId.trim() : undefined,
      });
      console.log('[webhook] payment.captured reconciled', orderId.trim());
      return res.status(200).json({ success: true });
    }

    if (order.paymentStatus === 'success' || payment.status === 'success') {
      console.log('[webhook] Failed ignored — already success', orderId.trim());
      return res.status(200).json({ success: true, message: 'Already success' });
    }

    if (payment.status === 'failed' && order.paymentStatus === 'failed') {
      console.log('[webhook] Already failed', orderId.trim());
      return res.status(200).json({ success: true, message: 'Already failed' });
    }

    await markPaymentFailed(db, {
      razorpayOrderId: paymentEntity.razorpayOrderId,
      orderId: orderId.trim(),
      razorpayPaymentId: paymentEntity.razorpayPaymentId,
      reason: body?.payload?.payment?.entity?.error_description ?? 'Payment failed',
      webhookEventId: typeof eventId === 'string' ? eventId.trim() : undefined,
    });
    console.log('[webhook] payment.failed reconciled', orderId.trim());
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[webhook] Processing failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message ?? 'Webhook processing failed',
    });
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
};
