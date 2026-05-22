require('dotenv').config();

const port = Number.parseInt(process.env.PORT ?? '', 10);

module.exports = {
  port: Number.isFinite(port) ? port : 5000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  firebaseServiceAccountPath:
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    'src/config/service-account.json',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
};
