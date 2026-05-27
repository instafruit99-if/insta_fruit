const admin = require('firebase-admin');
const { initializeFirebase } = require('../config/firebase');

async function verifyFirebaseToken(req, res, next) {
  try {
    initializeFirebase();

    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
}

module.exports = { verifyFirebaseToken };
