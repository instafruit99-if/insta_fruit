const admin = require('firebase-admin');
const { getFirestore } = require('../config/firestore');

async function testFirestore(req, res) {
  try {
    const db = getFirestore();

    await db.collection('backend_test').add({
      success: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      success: true,
      message: 'Firestore connected',
    });
  } catch (error) {
    console.error('Firestore test failed:', error);
    res.status(500).json({
      success: false,
      message: error.message ?? 'Firestore connection failed',
    });
  }
}

module.exports = {
  testFirestore,
};
