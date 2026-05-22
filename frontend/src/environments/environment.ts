export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000',
  // TODO: Replace these placeholders with your Firebase web config (Firebase Console → Project settings → Your apps → SDK setup)
  firebase: {
    apiKey: "AIzaSyDziBrk5HCpi4CarfqshoOJ8ZmpTBPuTr8",
    authDomain: "instafruit99-13755.firebaseapp.com",
    projectId: "instafruit99-13755",
    storageBucket: "instafruit99-13755.firebasestorage.app",
    messagingSenderId: "706736900017",
    appId: "1:706736900017:web:a3d09d102d650a922a5f90",
    measurementId: "G-PY5G388NYE"
  },
  // Razorpay public Key ID (frontend). Secret stays in backend .env only.
  razorpayKeyId: 'rzp_live_Ss9ttn45XVGU1N',
  /**
   * TEST ONLY — Razorpay charge amount in INR (not cart total).
   * Revert: set to `null` to use real cart total again.
   */
  razorpayTestAmountInr: 1 as number | null,
  /** Unsigned upload preset must allow folders: products, categories, banners, users (Cloudinary dashboard). */
  cloudinary: {
    cloudName: 'dnmuwin6h',
    uploadPreset: 'instafruit_products',
  },
};


//12399900
