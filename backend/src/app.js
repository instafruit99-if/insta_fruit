const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const paymentRoutes = require('./routes/payment.routes');
const locationRoutes = require('./routes/location.routes');
const refundsRoutes = require('./routes/refunds.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/payment', paymentRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/refunds', refundsRoutes);
app.use(routes);

module.exports = app;