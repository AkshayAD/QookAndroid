const target = process.argv[2] || 'web';

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_RAZORPAY_KEY_ID',
];

if (target === 'server' || process.env.CI || process.env.VERCEL) {
  required.push(
    'SUPABASE_SERVICE_ROLE_KEY',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'GEMINI_API_KEY'
  );
}

const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required ${target} environment variables: ${missing.join(', ')}`);
  console.error('Set the variables locally or in the deployment environment before building.');
  process.exit(1);
}

const razorpayKey = process.env.VITE_RAZORPAY_KEY_ID || '';
if (process.env.NODE_ENV === 'production' && razorpayKey.startsWith('rzp_test_')) {
  console.error('Production builds must not use a Razorpay test key.');
  process.exit(1);
}

console.log(`Environment validation passed for ${target}.`);
