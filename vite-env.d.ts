/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_ANDROID_WEB_AUTH_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
