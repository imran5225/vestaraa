# VÉSTARA — Your Personal AI Style Agent

A modern fashion-tech web application that turns your real-life wardrobe into personalized, occasion-aware outfit recommendations with interactive 3D avatar visualization and AI stylist chat.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Vite, TanStack Router & TanStack Query.
- **3D Visualization**: Lightweight Three.js avatar mannequin studio with customizable garments and colors.
- **Authentication & Database**: Supabase PostgreSQL with strict Row-Level Security (RLS) policies.
- **AI Fashion Engine**: Google Gemini API (`@google/genai`) with structured output parsing for garment recognition and conversational styling, backed by a deterministic recommendation engine.
- **Hosting & Deployment**: Vercel-ready with SPA fallback and static asset caching.

---

## Environment Configuration

Copy `.env.example` to `.env` and provide your project credentials:

```bash
cp .env.example .env
```

### Required Variables:

| Variable                   | Description                                        | Runtime              |
| :------------------------- | :------------------------------------------------- | :------------------- |
| `VITE_SUPABASE_URL`        | Supabase Project URL (`https://<ref>.supabase.co`) | Client & Server      |
| `VITE_SUPABASE_ANON_KEY`   | Supabase Anonymous Publishable Key                 | Client & Server      |
| `SUPABASE_URL`             | Supabase Project URL for server operations         | Server               |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase Publishable Key for server operations     | Server               |
| `GEMINI_API_KEY`           | Google Gemini API Key for AI features              | Server-only (Secret) |

_(Note: `GEMINI_MODEL` defaults to `gemini-3.8-flash` if not explicitly set)._

---

## Database Setup (Supabase)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Navigate to **SQL Editor** in your Supabase dashboard.
3. Run the complete schema script located at:
   ```
   supabase/migrations/20261025_vestara_schema_rls.sql
   ```
   This script creates all tables (`profiles`, `wardrobe_items`, `outfits`, `outfit_items`, `feedback`, `conversations`, `messages`, `tryon_looks`, `virtual_models`), Row-Level Security policies, and the private `wardrobe` storage bucket.

---

## Local Development

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start the local dev server**:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Run automated test suite**:

   ```bash
   npm test
   ```

4. **Verify linting**:

   ```bash
   npm run lint
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## Deploying to Vercel

1. Push your repository to GitHub or GitLab.
2. Import the repository into [Vercel](https://vercel.com).
3. The included `vercel.json` automatically detects the build command (`npm run build`) and output directory (`dist`).
4. In the Vercel project settings under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `GEMINI_API_KEY`
5. Click **Deploy**. Vercel will build and serve your production application with automatic SPA routing.
