const admin = require('firebase-admin');
const { getFirestore } = require('../config/firestore');
const { getRazorpay } = require('../config/razorpay');

async function processRefund(req, res) {
  try {
    const { orderId, reason } = req.body ?? {};
    if (typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'orderId is required',
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
    if (order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Order is not refundable',
      });
    }

    const razorpay = getRazorpay();
    const refund = await razorpay.payments.refund(order.paymentId, {
      amount: Math.round(order.total * 100),
      speed: 'normal',
      notes: { orderId: orderId.trim() },
    });

    const batch = db.batch();
    batch.update(orderRef, {
      paymentStatus: 'refunded',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(
      db.collection('refunds').doc(refund.id),
      {
        refundId: refund.id,
        orderId: orderId.trim(),
        paymentId: order.paymentId,
        userId: order.userId,
        amount: order.total,
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Admin initiated',
        status: 'processed',
        razorpayRefundId: refund.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await batch.commit();

    res.status(200).json({ success: true, razorpayRefundId: refund.id });
  } catch (error) {
    console.error('Process refund failed:', error);
    res.status(500).json({
      success: false,
      message: error.message ?? 'Refund processing failed',
    });
  }
}

module.exports = {
  processRefund,
};
