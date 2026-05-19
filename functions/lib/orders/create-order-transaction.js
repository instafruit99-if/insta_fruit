"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderTransaction = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const order_types_1 = require("./order-types");
const order_errors_1 = require("./order-errors");
const order_validation_1 = require("./order-validation");
const REGION = 'asia-south1';
const db = admin.firestore();
function aggregateCartQuantities(items) {
    const quantities = new Map();
    for (const item of items) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }
    return quantities;
}
async function runOrderTransaction(uid, input) {
    const orderRef = db.collection('orders').doc();
    const cartRef = db.collection('cart').doc(uid);
    return db.runTransaction(async (tx) => {
        const cartSnap = await tx.get(cartRef);
        if (!cartSnap.exists) {
            throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
        }
        const cart = cartSnap.data();
        if (cart.userId && cart.userId !== uid) {
            throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
        }
        const cartItems = cart.items ?? [];
        (0, order_validation_1.validateCartLineItems)(cartItems);
        const quantityByProduct = aggregateCartQuantities(cartItems);
        const productIds = [...quantityByProduct.keys()];
        const productSnaps = await Promise.all(productIds.map((productId) => tx.get(db.collection('products').doc(productId))));
        const orderProducts = [];
        let subtotal = 0;
        productSnaps.forEach((productSnap, index) => {
            const productId = productIds[index];
            const quantity = quantityByProduct.get(productId) ?? 0;
            if (!productSnap.exists) {
                throw (0, order_errors_1.orderHttpsError)('INVALID_PRODUCT');
            }
            const product = productSnap.data();
            if (product.isAvailable !== true) {
                throw (0, order_errors_1.orderHttpsError)('PRODUCT_UNAVAILABLE');
            }
            const stock = typeof product.stock === 'number' ? product.stock : 0;
            if (stock < quantity) {
                throw (0, order_errors_1.orderHttpsError)('OUT_OF_STOCK');
            }
            const unitPrice = (0, order_validation_1.productUnitPrice)(product.price, product.discountPrice);
            const lineTotal = +(unitPrice * quantity).toFixed(2);
            subtotal += lineTotal;
            const cartLine = cartItems.find((i) => i.productId === productId);
            orderProducts.push({
                productId,
                name: product.name,
                thumbnail: product.thumbnail ?? cartLine?.thumbnail ?? '',
                price: unitPrice,
                quantity,
                total: lineTotal,
            });
            tx.update(productSnap.ref, {
                stock: stock - quantity,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        subtotal = +subtotal.toFixed(2);
        const deliveryFee = order_types_1.DELIVERY_FEE_INR;
        const total = +(subtotal + deliveryFee).toFixed(2);
        const eta = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));
        tx.set(orderRef, {
            userId: uid,
            userName: input.userName,
            userPhone: input.userPhone,
            products: orderProducts,
            subtotal,
            deliveryFee,
            total,
            paymentMethod: input.paymentMethod,
            paymentStatus: 'pending',
            orderStatus: 'placed',
            deliverySlot: input.deliverySlot,
            estimatedArrivalTime: eta,
            address: input.address,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return orderRef.id;
    });
}
exports.createOrderTransaction = (0, https_1.onCall)({ region: REGION }, async (req) => {
    if (!req.auth) {
        throw (0, order_errors_1.orderHttpsError)('AUTH_REQUIRED');
    }
    const uid = req.auth.uid;
    const input = (0, order_validation_1.validateCreateOrderPayload)(req.data);
    const idempotencyRef = db.collection('orderIdempotency').doc(`${uid}_${input.requestId}`);
    try {
        await idempotencyRef.create({
            userId: uid,
            requestId: input.requestId,
            status: 'processing',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch {
        const existing = await idempotencyRef.get();
        if (!existing.exists) {
            throw (0, order_errors_1.orderHttpsError)('TRANSACTION_FAILED');
        }
        const data = existing.data();
        if (data?.status === 'completed' && typeof data.orderId === 'string') {
            return { orderId: data.orderId };
        }
        throw (0, order_errors_1.orderHttpsError)('ALREADY_PROCESSING');
    }
    try {
        const orderId = await runOrderTransaction(uid, input);
        await idempotencyRef.set({
            status: 'completed',
            orderId,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await db.collection('cart').doc(uid).set({
            userId: uid,
            items: [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return { orderId };
    }
    catch (error) {
        logger.error('createOrderTransaction failed', { uid, requestId: input.requestId, error });
        await idempotencyRef.delete().catch(() => undefined);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw (0, order_errors_1.orderHttpsError)('TRANSACTION_FAILED');
    }
});
//# sourceMappingURL=create-order-transaction.js.map