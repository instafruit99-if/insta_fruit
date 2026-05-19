"use strict";
/**
 * InstaFruit — Cloud Functions
 *
 * Deploy:
 *   1) firebase functions:config:set razorpay.key_id="rzp_test_xxx" razorpay.key_secret="xxx"
 *   2) firebase deploy --only functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateAnalytics = exports.onImageUpload = exports.onOrderStatusChange = exports.processRefund = exports.verifyRazorpayPayment = exports.createRazorpayOrder = exports.reverseGeocode = exports.createOrderTransaction = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const storage_1 = require("firebase-functions/v2/storage");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const params_1 = require("firebase-functions/params");
const logger = __importStar(require("firebase-functions/logger"));
const razorpay_1 = __importDefault(require("razorpay"));
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const db = admin.firestore();
var create_order_transaction_1 = require("./orders/create-order-transaction");
Object.defineProperty(exports, "createOrderTransaction", { enumerable: true, get: function () { return create_order_transaction_1.createOrderTransaction; } });
const RAZORPAY_KEY_ID = (0, params_1.defineSecret)('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = (0, params_1.defineSecret)('RAZORPAY_KEY_SECRET');
const GOOGLE_MAPS_API_KEY = (0, params_1.defineSecret)('GOOGLE_MAPS_API_KEY');
const REGION = 'asia-south1';
function pickComponent(components, type) {
    return components.find((c) => c.types.includes(type))?.long_name ?? '';
}
function parseGoogleResult(result) {
    const ac = result.address_components;
    const locality = pickComponent(ac, 'sublocality_level_1') ||
        pickComponent(ac, 'sublocality') ||
        pickComponent(ac, 'neighborhood') ||
        pickComponent(ac, 'locality');
    const city = pickComponent(ac, 'locality') || pickComponent(ac, 'administrative_area_level_2');
    const route = pickComponent(ac, 'route');
    const streetNumber = pickComponent(ac, 'street_number');
    const line1 = [streetNumber, route].filter(Boolean).join(' ') || result.formatted_address.split(',')[0]?.trim() || '';
    return {
        locality: locality || city,
        city: city || locality,
        state: pickComponent(ac, 'administrative_area_level_1'),
        postalCode: pickComponent(ac, 'postal_code'),
        country: pickComponent(ac, 'country'),
        line1,
        formattedAddress: result.formatted_address,
    };
}
/** Reverse geocode GPS coordinates (Google Geocoding API). Works for guests. */
exports.reverseGeocode = (0, https_1.onCall)({ region: REGION, secrets: [GOOGLE_MAPS_API_KEY] }, async (req) => {
    const { lat, lng } = req.data;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new https_1.HttpsError('invalid-argument', 'lat and lng required');
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid coordinates');
    }
    const key = GOOGLE_MAPS_API_KEY.value();
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const res = await fetch(url);
    const data = (await res.json());
    if (data.status !== 'OK' || !data.results?.[0]) {
        logger.warn('Geocode failed', { status: data.status, message: data.error_message });
        throw new https_1.HttpsError('not-found', data.error_message ?? 'Address not found');
    }
    return parseGoogleResult(data.results[0]);
});
/** Razorpay: create order on backend, return order to client to launch checkout. */
exports.createRazorpayOrder = (0, https_1.onCall)({ region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    const { orderId, amount, currency = 'INR' } = req.data;
    if (!orderId || !amount || amount <= 0) {
        throw new https_1.HttpsError('invalid-argument', 'orderId and positive amount required');
    }
    const orderSnap = await db.collection('orders').doc(orderId).get();
    if (!orderSnap.exists)
        throw new https_1.HttpsError('not-found', 'Order not found');
    if (orderSnap.data()?.userId !== req.auth.uid) {
        throw new https_1.HttpsError('permission-denied', 'Not your order');
    }
    const rzp = new razorpay_1.default({
        key_id: RAZORPAY_KEY_ID.value(),
        key_secret: RAZORPAY_KEY_SECRET.value(),
    });
    const rzpOrder = await rzp.orders.create({
        amount: Math.round(amount * 100), // paise
        currency,
        receipt: orderId,
        notes: { firebaseUid: req.auth.uid, orderId },
    });
    await db.collection('payments').doc(rzpOrder.id).set({
        paymentId: rzpOrder.id,
        orderId,
        userId: req.auth.uid,
        razorpayOrderId: rzpOrder.id,
        amount,
        currency,
        method: 'razorpay',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { razorpayOrderId: rzpOrder.id, amount, currency };
});
/** Razorpay: verify signature, mark order paid. */
exports.verifyRazorpayPayment = (0, https_1.onCall)({ region: REGION, secrets: [RAZORPAY_KEY_SECRET] }, async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.data;
    const expected = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET.value())
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
    if (expected !== razorpaySignature) {
        logger.warn('Invalid Razorpay signature', { razorpayOrderId, uid: req.auth.uid });
        throw new https_1.HttpsError('permission-denied', 'Invalid payment signature');
    }
    const batch = db.batch();
    batch.update(db.collection('payments').doc(razorpayOrderId), {
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
    });
    batch.update(db.collection('orders').doc(orderId), {
        paymentStatus: 'success',
        paymentId: razorpayPaymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { success: true };
});
/** Customer requests refund; admin approves; this function processes via Razorpay. */
exports.processRefund = (0, https_1.onCall)({ region: REGION, secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] }, async (req) => {
    if (!req.auth)
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    const callerSnap = await db.collection('users').doc(req.auth.uid).get();
    if (callerSnap.data()?.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Admin only');
    }
    const { orderId } = req.data;
    const orderSnap = await db.collection('orders').doc(orderId).get();
    if (!orderSnap.exists)
        throw new https_1.HttpsError('not-found', 'Order not found');
    const order = orderSnap.data();
    if (order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'success') {
        throw new https_1.HttpsError('failed-precondition', 'Order is not refundable');
    }
    const rzp = new razorpay_1.default({
        key_id: RAZORPAY_KEY_ID.value(),
        key_secret: RAZORPAY_KEY_SECRET.value(),
    });
    const refund = await rzp.payments.refund(order.paymentId, {
        amount: Math.round(order.total * 100),
        speed: 'normal',
        notes: { orderId },
    });
    const batch = db.batch();
    batch.update(db.collection('orders').doc(orderId), {
        paymentStatus: 'refunded',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('refunds').doc(refund.id), {
        refundId: refund.id,
        orderId,
        paymentId: order.paymentId,
        userId: order.userId,
        amount: order.total,
        reason: req.data.reason ?? 'Admin initiated',
        status: 'processed',
        razorpayRefundId: refund.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    return { success: true, razorpayRefundId: refund.id };
});
/** Notify on order status change (FCM hook-in point). */
exports.onOrderStatusChange = (0, firestore_1.onDocumentUpdated)({ region: REGION, document: 'orders/{orderId}' }, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.orderStatus === after.orderStatus)
        return;
    logger.info('Order status changed', {
        orderId: event.params.orderId,
        from: before.orderStatus,
        to: after.orderStatus,
    });
    // Hook FCM / email here.
});
/** Image upload trigger — placeholder for compression. */
exports.onImageUpload = (0, storage_1.onObjectFinalized)({ region: REGION, cpu: 1 }, async (event) => {
    logger.info('Storage upload', { name: event.data.name, size: event.data.size });
});
/** Daily aggregation of order/sales stats into analytics/{yyyy-MM-dd}. */
exports.aggregateAnalytics = (0, scheduler_1.onSchedule)({ region: REGION, schedule: 'every day 00:30', timeZone: 'Asia/Kolkata' }, async () => {
    const since = new Date();
    since.setDate(since.getDate() - 1);
    const snap = await db.collection('orders')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(since))
        .get();
    let totalSales = 0;
    let totalOrders = 0;
    let delivered = 0;
    snap.forEach((d) => {
        const o = d.data();
        totalOrders += 1;
        totalSales += o.total ?? 0;
        if (o.orderStatus === 'delivered')
            delivered += 1;
    });
    const key = since.toISOString().slice(0, 10);
    await db.collection('analytics').doc(key).set({
        date: key, totalOrders, totalSales, delivered,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
});
//# sourceMappingURL=index.js.map