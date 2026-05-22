const { Router } = require('express');
const { processRefund } = require('../controllers/refunds.controller');

const router = Router();

router.post('/process', processRefund);

module.exports = router;
