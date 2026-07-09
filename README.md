# PatternVault

A DSA / competitive-programming pattern tracker with LLM-assisted spaced
repetition review, an integrated Monaco code editor with sandboxed execution
(Judge0), a solve timer, and problem import from Codeforces and CodeChef
(LeetCode is manual-paste only, per their Terms of Service).

- **Backend:** Django + Django REST Framework, with token auth & per-user data isolation
- **Database:** [Neon](https://neon.tech) (managed serverless Postgres)
- **Frontend:** React + TypeScript + Tailwind CSS (Vite) + Monaco Editor, with login/register and a dark-mode toggle
- **Code execution:** self-hosted [Judge0](https://github.com/judge0/judge0) (sandboxed, resource-limited, shared-secret locked down)
- **LLM:** [OpenRouter](https://openrouter.ai) chat completions API
- **Codeforces:** official public API, no auth
- **CodeChef:** official developer API (OAuth client credentials)
- **Tests:** Django/pytest test suite covering spaced repetition math, auth, ownership isolation, and mocked Judge0/OpenRouter/Codeforces calls

---

## 1. Prerequisites

- Docker + Docker Compose (recommended path — spins up everything)
- OR, for running services individually: Python 3.12+, Node.js 20+, and a
  local/self-hosted Judge0 instance
- A free [Neon](https://neon.tech) account (Postgres database)
- A free [OpenRouter](https://openrouter.ai/keys) API key
- (Optional) CodeChef developer API credentials — see §5

---

## 2. Get a Neon database

1. Sign up at https://console.neon.tech and create a new project (e.g. `patternvault`).
2. On the project dashboard, open **Connection Details** and copy the
   **pooled connection string**. It looks like:
   ```
   postgres://<user>:<password>@ep-xxxx-pooler.<region>.aws.neon.tech/<dbname>?sslmode=require
   ```
3. You'll paste this into `backend/.env` as `DATABASE_URL` in the next step.

Neon's free tier is sufficient for local development and demoing this app.

---

## 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (§2) |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | Any OpenRouter model slug, e.g. `anthropic/claude-3.5-sonnet` |
| `JUDGE0_API_URL` | `http://localhost:2358` (default, matches docker-compose) |
| `JUDGE0_AUTH_TOKEN` | Any random string — must match `AUTHN_TOKEN` in `judge0.conf` at the repo root |
| `CODECHEF_API_KEY` / `CODECHEF_API_SECRET` | Register at https://developers.codechef.com/ (optional — CodeChef import will error clearly if unset, everything else still works) |

Codeforces requires **no** API key — it's a public, unauthenticated API.

---

## 4. Run everything with Docker Compose

```bash
docker compose up --build
```

This starts:
- `backend` — Django API on **http://localhost:8000**
- `frontend` — React/Vite dev server on **http://localhost:5173**
- `judge0-server` + `judge0-workers` + `db` + `redis` — self-hosted Judge0
  sandbox on **http://localhost:2358**, using the official Judge0 images and
  the `judge0.conf` file at the repo root (see
  https://github.com/judge0/judge0 for the full config reference)

On first boot, apply migrations and load demo data in a second terminal:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo_data
docker compose exec backend python manage.py createsuperuser   # optional, for /admin
```

`seed_demo_data` creates a demo login (**username: `demo`, password: `demopass123`**)
and assigns all 8 seeded problems to it, so you can log straight in and see data.

Then open **http://localhost:5173**, and log in as `demo` / `demopass123` (or register
your own account — every user only ever sees their own problems, pattern cards,
and review history).

> Judge0's workers can take ~30-60s to fully initialize on first startup
> (it provisions isolate sandboxes). If your first "Run" gets a connection
> error, wait a few seconds and retry.

---

## 5. Running without Docker (manual setup)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # then fill in values as in §3
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit **http://localhost:5173**. The Vite dev server proxies `/api/*` to
`http://localhost:8000` (see `vite.config.ts`).

---

## 8. Project structure

```
patternvault/
├── docker-compose.yml
├── judge0.conf
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── .env.example
│   ├── Dockerfile
│   ├── patternvault/          # Django project (settings, urls, wsgi)
│   └── core/                  # Django app
│       ├── models.py          # Problem (owned by User), Topic, PatternCard, ReviewLog, PostMortem, TestRun
│       ├── serializers.py     # incl. RegisterSerializer / UserSerializer
│       ├── views.py           # ViewSets (owner-scoped) + custom endpoints (auth, execute, review-queue, LLM, etc.)
│       ├── urls.py            # incl. /auth/register/, /auth/login/, /auth/me/
│       ├── admin.py
│       ├── tests.py           # 17 tests: scheduler math, auth, ownership isolation, mocked integrations
│       ├── services/
│       │   ├── spaced_repetition.py   # simplified SM-2
│       │   ├── openrouter.py          # LLM pattern-card / postmortem / quiz generation
│       │   ├── judge0.py              # sandboxed code execution client (shared-secret auth)
│       │   ├── codeforces.py          # public CF API client, throttled
│       │   └── codechef.py            # CodeChef developer API client, throttled
│       ├── management/commands/seed_demo_data.py   # seeds data + a demo/demopass123 user
│       └── fixtures/seed_data.json    # 8 example problems across 6 topics
└── frontend/
    ├── package.json / vite.config.ts / tailwind.config.js / tsconfig.json
    ├── Dockerfile
    └── src/
        ├── main.tsx / App.tsx         # routes, AuthProvider, protected-route gating
        ├── types.ts
        ├── api/client.ts              # typed axios wrapper, token auth header, pagination-follower
        ├── context/AuthContext.tsx    # login/register/logout state, token persistence
        ├── components/
        │   ├── NavBar.tsx             # nav + dark-mode toggle + logout
        │   ├── ProtectedRoute.tsx     # redirects to /login when signed out
        │   ├── Timer.tsx / PatternCard.tsx / DiffView.tsx
        └── pages/
            ├── Login.tsx              # combined login/register form
            ├── ImportProblem.tsx      # CF / CodeChef / manual-paste import
            ├── Workspace.tsx          # Monaco editor, timer, run/submit, pattern card gen, reimpl mode
            ├── PostMortemForm.tsx
            ├── ReviewQueue.tsx        # daily review + quiz mode
            ├── Dashboard.tsx          # pattern cards by category, filterable problem table, digest, export
            └── Stats.tsx              # per-topic / per-week charts, review streak
```

---

## 9. API reference (selected endpoints)

Every endpoint below requires `Authorization: Token <your-token>` (obtained
from `/api/auth/login/` or `/api/auth/register/`), except registration and
login themselves. Full CRUD via DRF routers, all owner-scoped: `/api/topics/`,
`/api/problems/`, `/api/pattern-cards/`, `/api/review-logs/`,
`/api/postmortems/`, `/api/test-runs/`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register/` | Create an account, returns a token |
| POST | `/api/auth/login/` | Exchange username+password for a token |
| GET | `/api/auth/me/` | Current user's profile |
| GET | `/api/codeforces/problem/{contest_id}/{index}/` | Fetch CF problem metadata *(throttled: 20/min)* |
| GET | `/api/codechef/problem/{problem_code}/` | Fetch CodeChef problem metadata *(throttled: 20/min)* |
| POST | `/api/execute/` | Run code through Judge0 sandbox *(throttled: 30/min)* |
| GET | `/api/review-queue/` | Due `PatternCard`s (yours only), most overdue first |
| POST | `/api/problems/{id}/generate-pattern-card/` | LLM pattern extraction *(throttled: 20/min)* |
| POST | `/api/problems/{id}/postmortem/` | Save post-mortem + LLM-merge into pattern card *(throttled: 20/min)* |
| POST | `/api/pattern-cards/{id}/quiz/` | LLM-generated isomorphic quiz problem *(throttled: 20/min)* |
| GET | `/api/weekly-digest/` | LLM summary of the week's weak patterns *(throttled: 20/min)* |
| GET | `/api/export/markdown/` | Download your pattern cards as `.md` |
| GET | `/api/stats/overview/` | Per-topic and per-week stats, for the Stats page |

`GET /api/problems/` also accepts `?status=`, `?source=`, `?topic=`, and
`?search=` — the Dashboard's filter bar is a thin UI over these.

---

## 10. Safety / ToS / security constraints this app enforces

- **No LeetCode scraping, GraphQL calls, or login automation** — manual
  paste only.
- **Client-side throttling (~1 req / 2s)** on both Codeforces and CodeChef
  API calls, plus **server-side rate limits** (`ScopedRateThrottle`) on
  `/execute/` (30/min) and every LLM/import endpoint (20/min) so no single
  user can hammer Judge0 or burn through your OpenRouter quota.
- **All code execution goes through Judge0's sandbox** with strict CPU-time
  (5s) and memory (256MB) limits — the Django process never `eval`/`exec`s
  user-submitted code directly. Judge0 itself is locked behind a shared
  secret (`JUDGE0_AUTH_TOKEN` / `AUTHN_TOKEN`) so it can't be used as an
  open remote-execution endpoint if `2358` is ever exposed.
- **Every user only sees their own data.** `Problem` (and everything hanging
  off it — pattern cards, review logs, post-mortems, test runs) is scoped to
  `owner=request.user` at the queryset level; this is covered by
  `ProblemOwnershipTests` in `core/tests.py`.
- **Token authentication is required on every endpoint** except registration
  and login themselves (`DEFAULT_PERMISSION_CLASSES = [IsAuthenticated]`).
- **Production hardening auto-enables when `DJANGO_DEBUG=False`**: HSTS,
  secure cookies, SSL redirect, and `X-Frame-Options: DENY` — see the bottom
  of `backend/patternvault/settings.py`.

---

## 11. Admin panel

All models are registered at **http://localhost:8000/admin/** for quick
manual inspection (create a superuser first — see §5).
