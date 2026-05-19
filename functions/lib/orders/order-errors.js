"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_ERROR_MESSAGES = void 0;
exports.orderHttpsError = orderHttpsError;
const https_1 = require("firebase-functions/v2/https");
exports.ORDER_ERROR_MESSAGES = {
    AUTH_REQUIRED: 'Authentication required',
    INVALID_CART: 'Invalid cart',
    OUT_OF_STOCK: 'Product out of stock',
    PRODUCT_UNAVAILABLE: 'Product unavailable',
    INVALID_PRODUCT: 'Invalid product',
    ALREADY_PROCESSING: 'Order already processing',
    TRANSACTION_FAILED: 'Transaction failed',
};
const ERROR_HTTP_CODE = {
    AUTH_REQUIRED: 'unauthenticated',
    INVALID_CART: 'invalid-argument',
    OUT_OF_STOCK: 'failed-precondition',
    PRODUCT_UNAVAILABLE: 'failed-precondition',
    INVALID_PRODUCT: 'invalid-argument',
    ALREADY_PROCESSING: 'already-exists',
    TRANSACTION_FAILED: 'internal',
};
function orderHttpsError(code) {
    return new https_1.HttpsError(ERROR_HTTP_CODE[code], exports.ORDER_ERROR_MESSAGES[code]);
}
//# sourceMappingURL=order-errors.js.map