/**
 * Writes environment.production.ts from CI/local env vars.
 * Used by GitHub Pages and Firebase Hosting deploys.
 *
 * Required env:
 *   BACKEND_API_URL  — public HTTPS backend (e.g. https://instafruit-api.onrender.com)
 *   RAZORPAY_KEY_ID  — Razorpay public key (rzp_live_… or rzp_test_…)
 */
const fs = require('fs');
const path = require('path');

const apiUrl = (process.env.BACKEND_API_URL ?? '').trim().replace(/\/$/, '');
const razorpayKeyId = (process.env.RAZORPAY_KEY_ID ?? '').trim();

function fail(message) {
  console.error(`write-production-env: ${message}`);
  process.exit(1);
}

if (!apiUrl) {
  fail('BACKEND_API_URL is required (public HTTPS URL, no trailing slash).');
}
if (!razorpayKeyId) {
  fail('RAZORPAY_KEY_ID is required.');
}
if (
  process.env.CI === 'true' &&
  !apiUrl.startsWith('https://') &&
  !apiUrl.startsWith('http://127.0.0.1')
) {
  fail('In CI, BACKEND_API_URL must use HTTPS (GitHub Pages cannot call http://localhost).');
}

const templatePath = path.join(
  __dirname,
  '../src/environments/environment.production.template.ts',
);
const outputPath = path.join(__dirname, '../src/environments/environment.production.ts');

let content = fs.readFileSync(templatePath, 'utf8');
content = content
  .replace('__API_URL__', apiUrl.replace(/'/g, "\\'"))
  .replace('__RAZORPAY_KEY_ID__', razorpayKeyId.replace(/'/g, "\\'"));

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`  apiUrl: ${apiUrl}`);
