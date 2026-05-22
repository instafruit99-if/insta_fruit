const Razorpay = require('razorpay');
const { razorpayKeyId, razorpayKeySecret } = require('./env');

let razorpayInstance = null;

function getRazorpay() {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error('Razorpay credentials are not configured');
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
  }

  return razorpayInstance;
}

module.exports = {
  getRazorpay,
};
