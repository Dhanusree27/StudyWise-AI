# StudyWise AI – Your Personal AI Study Planner
React (Vite) + Supabase (auth, Postgres, row-level security) + Vercel serverless function for Gemini.

## 1. Install
`npm install`
## 2. Database (Supabase)
Create a project at supabase.com. Open **SQL Editor**, paste `supabase/schema.sql`, run it. This creates all tables and Row Level Security so each student can only read/write their own rows. In **Authentication > URL Configuration** add your site URL (e.g. http://localhost:3000 and your deployed URL) so password-reset links work.
## 3. Environment variables
Copy `.env.example` to `.env` and fill in: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Project Settings > API), the same two as `SUPABASE_URL`/`SUPABASE_ANON_KEY` for the server, and `GEMINI_API_KEY` (Google AI Studio). Never commit `.env`.
## 4. Run locally
- UI only (no AI): `npm run dev`
- With AI endpoint: `npm i -g vercel`, then `vercel dev` (serves `/api/ai` too).
## 5. Gemini
`api/ai.js` runs on the server, checks the student's Supabase login token, then calls Gemini with `GEMINI_API_KEY`. Without a key the app works normally and shows "The AI helper is not set up yet." Change model with `GEMINI_MODEL`.
## 6. Build
`npm run build` (output in `dist/`).
## 7. Deploy (Vercel)
Import the repo, add the environment variables from step 3 in Project Settings, deploy. `vercel.json` handles page routing.

## Code map
- `src/lib/planner.js` – deterministic planning engine (slots, phases, priorities, spaced revision, feasibility)
- `src/lib/planService.js` – saves plans and does "Change My Plan" rebalancing
- `src/lib/db.js` – database access; `src/Setup.jsx`, `src/Views.jsx`, `src/Auth.jsx` – pages
