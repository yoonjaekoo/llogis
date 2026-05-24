# AGENTS.md — Logis (Math Solved)

## Project overview
Korean math problem-solving platform with Glicko-2 rating system. Three-part stack:
- `frontend/` — React 19 + Vite 6 + KaTeX (SPA, all routes in `src/App.tsx`)
- `backend/` — Express + TypeScript (monolithic, all routes in `src/index.ts`)
- `database/` — PostgreSQL schema (auto-loaded on container init via `docker-entrypoint-initdb.d`)

## Commands
| Context | Command | Notes |
|---------|---------|-------|
| Full stack | `docker-compose up -d` | Frontend :1972, Backend :5000, DB :5432 |
| Backend dev | `cd backend && npm install && npm run dev` | Uses nodemon |
| Frontend dev | `cd frontend && npm install && npm run dev` | :5173 (proxies /api → :5000) |
| Build backend | `cd backend && npm install --include=dev && npm run build` | `--include=dev` needed for `@types/*` in tsc |
| Build frontend | `cd frontend && npm install && npm run build` | Runs `tsc && vite build` |

## Architecture gotchas
- **Rating is a lie**: `ratingService.ts` creates its own `pg.Pool` (separate from `index.ts`), and ignores `Glicko2Engine` completely. It applies a flat +10,000 for correct answers (capped at 100M) and +0 for wrong. The `Glicko2Engine` class exists but is unused.
- **No tests exist**: both `npm test` placeholders (`echo "Error: no test specified" && exit 1`)
- **No ESLint config present**: `frontend` has `"lint": "eslint ."` script but no `.eslintrc*` file
- **Admin account**: username `admin`, seeded via `database/schema.sql`. Admin panel at `/admin` route.
- **Auth**: JWT tokens stored in `localStorage`, sent as `Authorization: Bearer <token>`. Token expiry 24h.
- **Docker BuildKit issues on ARM**: if `parent snapshot does not exist` error, run `docker builder prune -af`. `docker-compose.yml` sets `provenance: false, sbom: false`.

## Database
- Schema: `database/schema.sql` — mounted as init script, runs automatically on first container start
- App also runs `ensureSchema()` at startup for additional tables/columns
- Tables: `users`, `problems`, `submissions`, `tags`, `problem_tags`, `groups`, `group_members`, `group_join_requests`, `group_competitions`, `group_competition_participants`
- 100 seed problems pre-loaded with Korean math content (linear equations, systems, inequalities, functions)
- Profiles: profile images stored on disk at `backend/uploads/`, served via `/uploads/` static route

## Key conventions
- **UI language**: Korean (한국어) — all UI text, comments, commits should be in Korean
- **Styling**: Vanilla CSS in `frontend/src/styles/globals.css` with CSS custom properties for theming (light/dark toggle)
- **LaTeX**: rendered with `react-katex`. Content uses `$$...$$` for display math, `$...$` for inline math.
- **Answer comparison**: submitted answers are whitespace-stripped and lowercased before string comparison
- **Problem generation**: `backend/src/problemGenerator.ts` uses templates with random variables, ensures integer answers for equations
- **Tier thresholds**: Bronze (<100k), Silver (<300k), Gold (<800k), Platinum (<2M), Diamond (<5M), Ruby (<12M), Master (<30M), God (<70M), Hacker (≥70M)

## Dev server notes
- Frontend Vite proxy routes `/api` and `/uploads` to `http://localhost:5000`
- Nginx in production (Docker) proxies `/api/` and `/uploads/` to `backend:5000`

## 필수 규칙
- **작업 완료 후 반드시 `git add`, `git commit`, `git push`를 실행할 것** — 장기 저장소(lgit)에 수정사항이 반영되어야 함