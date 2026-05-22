const app = require('./app');
const { port, nodeEnv } = require('./config/env');
const { initializeFirebase } = require('./config/firebase');

try {
  initializeFirebase();
  console.log('Firebase Admin initialized');
} catch (error) {
  console.warn(
    `Firebase Admin not initialized: ${error.message}. Payment verify and Firestore APIs will fail until service-account.json is added.`,
  );
}

app.listen(port, () => {
  console.log(`Server running on port ${port} (${nodeEnv})`);
});
