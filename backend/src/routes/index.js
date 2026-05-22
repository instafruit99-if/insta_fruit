const { Router } = require('express');
const healthRoutes = require('./health.routes');
const firestoreRoutes = require('./firestore.routes');

const router = Router();

router.use(healthRoutes);
router.use('/api', firestoreRoutes);

module.exports = router;
