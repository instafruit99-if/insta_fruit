const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const paymentRoutes = require('./routes/payment.routes');
const locationRoutes = require('./routes/location.routes');
const refundsRoutes = require('./routes/refunds.routes');
const { handleWebhook } = require('./controllers/payment.controller');
const { corsOrigins } = require('./config/env');

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  }),
);

// Webhook must receive raw body for Razorpay signature verification
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook,
);

app.use(express.json());
app.use('/api/payment', paymentRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/refunds', refundsRoutes);
app.use(routes);

module.exports = app;