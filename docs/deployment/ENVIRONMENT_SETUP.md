# Environment Setup Guide

> **Last Updated:** January 2026  
> **For:** New developers joining the project

---

## Prerequisites

- **Node.js** v18+ 
- **npm** or **pnpm**
- **Git**
- **VS Code** (recommended)

---

## 1. Clone Repository

```bash
git clone https://github.com/yourorg/Cook-Commander.git
cd Cook-Commander
```

---

## 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

---

## 3. Environment Variables

Create `.env.local` in root directory:

```env
# Supabase
VITE_SUPABASE_URL=https://igcmhlfonulqtxsiiisb.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Razorpay (use test keys for development)
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Gemini AI
VITE_GEMINI_API_KEY=your_gemini_api_key

# App URL
VITE_APP_URL=http://localhost:3000
```

### Getting Keys

| Service | Where to Get |
|---------|--------------|
| Supabase | https://supabase.com/dashboard → Project Settings → API |
| Razorpay | https://dashboard.razorpay.com → Account & Settings → API Keys |
| Gemini | https://makersuite.google.com/app/apikey |

---

## 4. Run Development Server

```bash
npm run dev
```

Opens at http://localhost:3000

---

## 5. Supabase Setup

### Local Development with Supabase
We use the hosted Supabase instance. No local setup needed.

### Database Access
- **Dashboard:** https://supabase.com/dashboard/project/igcmhlfonulqtxsiiisb
- **SQL Editor:** Use dashboard for direct queries

### Migrations
Located in `supabase/migrations/`. Apply via dashboard or CLI:
```bash
supabase db push
```

---

## 6. Razorpay Test Mode

For development, use Razorpay test mode:
1. Get test API keys from Razorpay dashboard
2. Use test card: `4111 1111 1111 1111`
3. Use test UPI: `success@razorpay`

---

## 7. VS Code Extensions

Recommended extensions:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Importer
- GitLens

---

## 8. Project Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 9. Deployment

### Automatic (Recommended)
Push to `main` branch → Vercel auto-deploys

### Manual
```bash
vercel --prod
```

---

## 10. Common Issues

### "Module not found"
```bash
rm -rf node_modules
npm install
```

### "Supabase auth error"
Check `.env.local` has correct keys and URL.

### "Razorpay checkout not opening"
Verify Razorpay key ID starts with `rzp_test_` for test mode.

### "Build fails on Vercel"
Check Vercel environment variables match local `.env.local`.

---

## 11. Key Contacts

| Role | Contact |
|------|---------|
| Project Lead | [Add contact] |
| Supabase Admin | [Add contact] |
| Razorpay Admin | [Add contact] |
