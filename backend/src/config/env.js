require('dotenv').config();

const fs = require('fs');
const path = require('path');

const port = Number.parseInt(process.env.PORT ?? '', 10);

function loadDefaultCorsOrigins() {
  try {
    const configPath = path.resolve(__dirname, '../../../config/production-frontends.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (Array.isArray(config.frontendOrigins) && config.frontendOrigins.length > 0) {
      return config.frontendOrigins;
    }
  } catch {
    /* fall through */
  }
  return [
    'http://localhost:3000',
    'http://localhost:4200',
    'https://instafruit99-if.github.io',
    'https://instafruit99-13755.web.app',
    'https://instafruit99-13755.firebaseapp.com',
  ];
}

module.exports = {
  port: Number.isFinite(port) ? port : 5000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  firebaseServiceAccountPath:
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    'src/config/service-account.json',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  corsOrigins: (process.env.CORS_ORIGINS ?? loadDefaultCorsOrigins().join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
