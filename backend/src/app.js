const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const paymentRoutes = require('./routes/payment.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/payment', paymentRoutes);
app.use(routes);

module.exports = app;
