const { Router } = require('express');
const { createOrder, verifyPayment } = require('../controllers/payment.controller');
const { verifyFirebaseToken } = require('../middleware/verifyFirebaseToken');

const router = Router();

router.use(verifyFirebaseToken);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);

module.exports = router;
