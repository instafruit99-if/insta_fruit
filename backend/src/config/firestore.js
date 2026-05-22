const admin = require('firebase-admin');
const { initializeFirebase } = require('./firebase');

let firestoreInstance = null;

function getFirestore() {
  if (!firestoreInstance) {
    initializeFirebase();
    firestoreInstance = admin.firestore();
  }

  return firestoreInstance;
}

module.exports = {
  getFirestore,
};
