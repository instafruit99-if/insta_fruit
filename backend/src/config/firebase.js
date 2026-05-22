const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { firebaseServiceAccountPath } = require('./env');

function resolveServiceAccountPath() {
  const resolved = path.isAbsolute(firebaseServiceAccountPath)
    ? firebaseServiceAccountPath
    : path.resolve(process.cwd(), firebaseServiceAccountPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Firebase service account file not found at: ${resolved}`,
    );
  }

  return resolved;
}

function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath = resolveServiceAccountPath();
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8'),
  );

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = {
  initializeFirebase,
};
