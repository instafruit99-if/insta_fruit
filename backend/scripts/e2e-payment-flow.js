/**
 * End-to-end payment flow test (mirrors frontend PaymentEngineService).
 * Run: node scripts/e2e-payment-flow.js
 */
require('dotenv').config();
const crypto = require('crypto');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { getRazorpay } = require('../src/config/razorpay');

const API = 'http://localhost:5000';
const FIREBASE_API_KEY = 'AIzaSyDziBrk5HCpi4CarfqshoOJ8ZmpTBPuTr8';
const TEST_UID = 'e2e-flow-test-user';
const TEST_ORDER_ID = `e2e-order-${Date.now()}`;

function log(step, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${step}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function getIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!data.idToken) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.idToken;
}

async function apiPost(route, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  const saPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }
  const db = admin.firestore();
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log('\n=== E2E Payment Flow Test ===\n');

  // 1. Unauthorized blocked
  const noAuth = await apiPost('/api/payment/create-order', { orderId: TEST_ORDER_ID }, null);
  log('Unauthorized create-order rejected', noAuth.status === 401, `status ${noAuth.status}`);

  const token = await getIdToken(TEST_UID);
  log('Firebase ID token obtained', !!token);

  const orderTotal = 1;
  const orderRef = db.collection('orders').doc(TEST_ORDER_ID);
  await orderRef.set({
    userId: TEST_UID,
    userName: 'E2E Test',
    total: orderTotal,
    subtotal: orderTotal,
    deliveryFee: 0,
    paymentMethod: 'razorpay',
    paymentStatus: 'pending',
    orderStatus: 'placed',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  log('Firestore test order created', true, `${TEST_ORDER_ID} total=₹${orderTotal}`);

  // 2. create-order (server reads Firestore total)
  const tampered = await apiPost(
    '/api/payment/create-order',
    { orderId: TEST_ORDER_ID, amount: 99999 },
    token,
  );
  const expectedPaise = Math.round(orderTotal * 100);
  log(
    'create-order succeeds',
    tampered.status === 200 && tampered.json.id,
    `razorpayOrderId=${tampered.json.id}`,
  );
  log(
    'Amount from Firestore (not tampered body)',
    tampered.json.amount === expectedPaise,
    `got ${tampered.json.amount} paise, expected ${expectedPaise}`,
  );

  const razorpayOrderId = tampered.json.id;

  // 3. Confirm order exists on Razorpay
  const razorpay = getRazorpay();
  const rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
  log(
    'Razorpay order exists',
    rzpOrder.status === 'created' && rzpOrder.amount === expectedPaise,
    `status=${rzpOrder.status}`,
  );

  // 4. Create payment doc (mirrors frontend)
  const paymentRef = db.collection('payments').doc(razorpayOrderId);
  await paymentRef.set({
    paymentId: razorpayOrderId,
    orderId: TEST_ORDER_ID,
    userId: TEST_UID,
    razorpayOrderId,
    amount: orderTotal,
    currency: 'INR',
    method: 'razorpay',
    status: 'pending',
    failureReason: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  log('Payment doc created', true, `payments/${razorpayOrderId}`);

  // 5. verify-payment (simulates Razorpay success callback)
  const fakePaymentId = `pay_e2e_${Date.now()}`;
  const signature = crypto
    .createHmac('sha256', razorpaySecret)
    .update(`${razorpayOrderId}|${fakePaymentId}`)
    .digest('hex');

  const verify = await apiPost(
    '/api/payment/verify',
    {
      razorpayOrderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: signature,
      orderId: TEST_ORDER_ID,
    },
    token,
  );
  log('verify-payment succeeds', verify.status === 200 && verify.json.success === true, `status ${verify.status}`);

  const [orderAfter, paymentAfter] = await Promise.all([orderRef.get(), paymentRef.get()]);
  log(
    'Firestore order updated',
    orderAfter.data().paymentStatus === 'success' && orderAfter.data().paymentId === fakePaymentId,
    `paymentStatus=${orderAfter.data().paymentStatus}`,
  );
  log(
    'Firestore payment updated',
    paymentAfter.data().status === 'success',
    `status=${paymentAfter.data().status}`,
  );

  // 6. Replay blocked
  const replay = await apiPost(
    '/api/payment/verify',
    {
      razorpayOrderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: signature,
      orderId: TEST_ORDER_ID,
    },
    token,
  );
  log(
    'Duplicate verify blocked',
    replay.status === 400 && replay.json.message === 'Payment already processed',
    replay.json.message,
  );

  // Cleanup
  await Promise.all([orderRef.delete(), paymentRef.delete()]);
  log('Test data cleaned up', true);

  console.log('\n=== Done ===\n');
  if (process.exitCode) process.exit(process.exitCode);
}

main().catch((err) => {
  console.error('\nE2E test crashed:', err.message);
  process.exit(1);
});
