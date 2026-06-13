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
| Backend test | `cd backend && npm test` | Runs vitest (73 tests for generation engine) |
| Backend test watch | `cd backend && npm run test:watch` | Vitest watch mode |

## Architecture gotchas
- **Rating is a lie**: `ratingService.ts` creates its own `pg.Pool` (separate from `index.ts`), and ignores `Glicko2Engine` completely. It applies a flat +10,000 for correct answers (capped at 100M) and +0 for wrong. The `Glicko2Engine` class exists but is unused.
- **Problem generation engine**: `backend/src/generation/` — modular engine with safe math parser, variable generator, constraint validator, template renderer. No `eval()`. Recursive-descent parser, caches ASTs for performance (~0.01ms/problem).
- **Templates**: 31 templates in `backend/data/templates.json` (solution_template field stripped). Loaded by `templateProblemGenerator.ts` service.
- **Tests exist**: `backend/src/generation/__tests__/generation.test.ts` — 73 unit tests covering parser, evaluator, variable gen, constraints, templates, full pipeline, batch gen, error handling.
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
- **Problem generation**: `backend/src/generation/` — modular engine with template-based math problem generation. Template syntax uses `{{expression}}` for variable substitution and expression evaluation. See `backend/data/templates.json` for 31 template definitions.
- **New template API endpoints**: `POST /api/problems/templates/generate` — generates problems from templates (supports `templateId`, `unit`, `concept`, `count` params). `GET /api/problems/templates` lists all templates.
- **Tier thresholds**: Bronze (<100k), Silver (<300k), Gold (<800k), Platinum (<2M), Diamond (<5M), Ruby (<12M), Master (<30M), God (<70M), Hacker (<150M), 치피치피차파차파 (<300M), ChatGPT (<600M), 출제자 (<1.2B), 주인장 (<2.5B), 정답 (≥2.5B)

## Generation engine API
```
import { generateProblem, batchGenerate } from './generation/index.js';
const result = generateProblem(template);   // single
const batch = batchGenerate(template, 100); // batch, ~0.01ms/problem
```
Template format: `{ id, title, difficulty, variables, constraints, problem_template, answer_formula }`
Variables support types: `integer`, `float`, `choice`, `boolean`. Constraints use same expression syntax as templates. If constraints fail, engine retries up to 50 times.

## Dev server notes
- Frontend Vite proxy routes `/api` and `/uploads` to `http://localhost:5000`
- Nginx in production (Docker) proxies `/api/` and `/uploads/` to `backend:5000`

## 필수 규칙
- **작업 완료 후 반드시 `git add`, `git commit`, `git push`를 실행할 것** — 장기 저장소(lgit)에 수정사항이 반영되어야 함