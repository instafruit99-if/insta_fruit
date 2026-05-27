/**
 * Webhook E2E tests. Run: node scripts/e2e-webhook-flow.js
 * Requires backend running with RAZORPAY_WEBHOOK_SECRET=test_webhook_secret_e2e
 */
require('dotenv').config();
const crypto = require('crypto');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:5000/api/payment/webhook';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret_e2e';
const TEST_ORDER_ID = `e2e-webhook-order-${Date.now()}`;
const RAZORPAY_ORDER_ID = `order_e2e_webhook_${Date.now()}`;

function log(step, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${step}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

function sign(body, secret = WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function postWebhook(body, { signature, eventId } = {}) {
  const raw = Buffer.from(JSON.stringify(body), 'utf8');
  const headers = { 'Content-Type': 'application/json' };
  if (signature !== false) {
    headers['x-razorpay-signature'] = signature ?? sign(raw);
  }
  if (eventId) headers['x-razorpay-event-id'] = eventId;

  const res = await fetch(API, { method: 'POST', headers, body: raw });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function capturedPayload(paymentId, orderId) {
  return {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: { id: paymentId, order_id: orderId, status: 'captured' },
      },
    },
  };
}

function failedPayload(paymentId, orderId) {
  return {
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          status: 'failed',
          error_description: 'Payment failed at bank',
        },
      },
    },
  };
}

async function main() {
  const saPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();

  console.log('\n=== Webhook E2E Test ===\n');

  const invalid = await postWebhook(capturedPayload('pay_x', RAZORPAY_ORDER_ID), {
    signature: 'bad-signature',
    eventId: 'evt-invalid',
  });
  log('Invalid signature rejected', invalid.status === 400, `status ${invalid.status}`);

  const orderRef = db.collection('orders').doc(TEST_ORDER_ID);
  const paymentRef = db.collection('payments').doc(RAZORPAY_ORDER_ID);
  await orderRef.set({
    userId: 'e2e-webhook-user',
    total: 1,
    paymentStatus: 'pending',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await paymentRef.set({
    paymentId: RAZORPAY_ORDER_ID,
    orderId: TEST_ORDER_ID,
    userId: 'e2e-webhook-user',
    status: 'pending',
    method: 'razorpay',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const paymentId = `pay_e2e_${Date.now()}`;
  const eventId = `evt_${Date.now()}`;

  // Missed frontend verify — webhook reconciles
  const captured = await postWebhook(capturedPayload(paymentId, RAZORPAY_ORDER_ID), {
    eventId,
  });
  log('payment.captured accepted', captured.status === 200, captured.json.message ?? 'ok');

  const [orderAfter, paymentAfter] = await Promise.all([orderRef.get(), paymentRef.get()]);
  log(
    'Firestore reconciled to success',
    orderAfter.data().paymentStatus === 'success' &&
      paymentAfter.data().status === 'success' &&
      paymentAfter.data().razorpayPaymentId === paymentId,
    `order=${orderAfter.data().paymentStatus} payment=${paymentAfter.data().status}`,
  );

  const duplicate = await postWebhook(capturedPayload(paymentId, RAZORPAY_ORDER_ID), {
    eventId,
  });
  log(
    'Duplicate webhook ignored',
    duplicate.status === 200 && duplicate.json.message === 'Duplicate webhook',
    duplicate.json.message,
  );

  // payment.failed on new pending order
  const failOrderId = `${TEST_ORDER_ID}-fail`;
  const failRzpOrderId = `${RAZORPAY_ORDER_ID}_fail`;
  await db.collection('orders').doc(failOrderId).set({
    userId: 'e2e-webhook-user',
    total: 1,
    paymentStatus: 'pending',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('payments').doc(failRzpOrderId).set({
    paymentId: failRzpOrderId,
    orderId: failOrderId,
    userId: 'e2e-webhook-user',
    status: 'pending',
    method: 'razorpay',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const failPaymentId = `pay_fail_${Date.now()}`;
  const failEventId = `evt_fail_${Date.now()}`;
  const failed = await postWebhook(failedPayload(failPaymentId, failRzpOrderId), {
    eventId: failEventId,
  });
  log('payment.failed accepted', failed.status === 200);

  const failOrderSnap = await db.collection('orders').doc(failOrderId).get();
  const failPaymentSnap = await db.collection('payments').doc(failRzpOrderId).get();
  log(
    'Firestore reconciled to failed',
    failOrderSnap.data().paymentStatus === 'failed' &&
      failPaymentSnap.data().status === 'failed',
    `order=${failOrderSnap.data().paymentStatus}`,
  );

  await Promise.all([
    orderRef.delete(),
    paymentRef.delete(),
    db.collection('orders').doc(failOrderId).delete(),
    db.collection('payments').doc(failRzpOrderId).delete(),
  ]);
  log('Test data cleaned up', true);

  console.log('\n=== Done ===\n');
  if (process.exitCode) process.exit(process.exitCode);
}

main().catch((err) => {
  console.error('\nWebhook test crashed:', err.message);
  process.exit(1);
});
