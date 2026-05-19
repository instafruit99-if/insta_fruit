"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCreateOrderPayload = validateCreateOrderPayload;
exports.validateCartLineItems = validateCartLineItems;
exports.productUnitPrice = productUnitPrice;
const order_errors_1 = require("./order-errors");
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isValidPaymentMethod(value) {
    return value === 'cod' || value === 'razorpay';
}
function validateAddress(address) {
    if (!address || typeof address !== 'object') {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    const a = address;
    if (!isNonEmptyString(a['label']) ||
        !isNonEmptyString(a['line1']) ||
        !isNonEmptyString(a['city']) ||
        !isNonEmptyString(a['state']) ||
        !isNonEmptyString(a['postalCode']) ||
        !isNonEmptyString(a['country'])) {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    return {
        label: a['label'].trim(),
        line1: a['line1'].trim(),
        line2: typeof a['line2'] === 'string' ? a['line2'].trim() : undefined,
        locality: typeof a['locality'] === 'string' ? a['locality'].trim() : undefined,
        city: a['city'].trim(),
        state: a['state'].trim(),
        postalCode: a['postalCode'].trim(),
        country: a['country'].trim(),
        phone: typeof a['phone'] === 'string' ? a['phone'].trim() : undefined,
        coordinates: a['coordinates'] &&
            typeof a['coordinates'] === 'object' &&
            typeof a['coordinates'].lat === 'number' &&
            typeof a['coordinates'].lng === 'number'
            ? {
                lat: a['coordinates'].lat,
                lng: a['coordinates'].lng,
            }
            : undefined,
    };
}
function validateCreateOrderPayload(data) {
    if (!data || typeof data !== 'object') {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    const payload = data;
    if (!isNonEmptyString(payload['requestId'])) {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    if (!isNonEmptyString(payload['userName']) || !isNonEmptyString(payload['userPhone'])) {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    if (!isNonEmptyString(payload['deliverySlot'])) {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    if (!isValidPaymentMethod(payload['paymentMethod'])) {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    return {
        requestId: payload['requestId'].trim(),
        userName: payload['userName'].trim(),
        userPhone: payload['userPhone'].trim(),
        paymentMethod: payload['paymentMethod'],
        deliverySlot: payload['deliverySlot'].trim(),
        address: validateAddress(payload['address']),
    };
}
function validateCartLineItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
    }
    for (const item of items) {
        if (!item || typeof item !== 'object') {
            throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
        }
        const row = item;
        if (!isNonEmptyString(row['productId'])) {
            throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
        }
        const qty = row['quantity'];
        if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
            throw (0, order_errors_1.orderHttpsError)('INVALID_CART');
        }
    }
}
function productUnitPrice(price, discountPrice) {
    if (typeof discountPrice === 'number' && Number.isFinite(discountPrice) && discountPrice > 0) {
        return discountPrice;
    }
    return price;
}
//# sourceMappingURL=order-validation.js.map