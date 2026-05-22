const { Router } = require('express');
const { reverseGeocode } = require('../controllers/location.controller');

const router = Router();

router.post('/reverse-geocode', reverseGeocode);

module.exports = router;
