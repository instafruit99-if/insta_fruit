const { Router } = require('express');
const { testFirestore } = require('../controllers/firestore.controller');

const router = Router();

router.get('/test-firestore', testFirestore);

module.exports = router;
