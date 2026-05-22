const { Router } = require('express');
const { createOrder } = require('../controllers/payment.controller');

const router = Router();

router.post('/create-order', createOrder);

module.exports = router;
