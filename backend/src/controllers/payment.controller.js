const { getRazorpay } = require('../config/razorpay');

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

module.exports = {
  createOrder,
};
