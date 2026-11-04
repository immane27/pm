# Project Plan

## Conventions

- Repo root is `pm/`. Frontend in `frontend/`, backend in `backend/`, scripts in `scripts/`, docs in `docs/`.
- One Docker image: a Node stage builds the static Next.js site, a Python stage (uv) runs FastAPI, which serves the site at `/` and the API under `/api`.
- SQLite database file lives on a Docker volume so data survives container restarts.
- `OPENROUTER_API_KEY` is read from `pm/.env`, passed to the container with `--env-file`.
- Python 3.15 (pinned in `backend/.python-version`, image `python:3.15-slim`); Node 24 for the frontend build stage.
- Work proceeds one part at a time. After each part: all tests pass, then stop for user review. Commit only when the user asks.

## Testing standard

- Unit test coverage must be at least 80% (lines) for both frontend and backend, enforced by the tooling so the run fails below threshold:
  - Frontend: Vitest with `@vitest/coverage-v8`, `coverage.thresholds` set to 80 in `vitest.config.ts`; run with `npm run test:coverage`.
  - Backend: pytest with `pytest-cov`, `--cov=app --cov-fail-under=80` in `pyproject.toml`.
- Integration/e2e tests use Playwright against the running Docker container (not `next dev`) from Part 3 onward.
  - Run with one worker: all tests share the single `user` account and its one board.
  - Board tests reset the board to the default before each test. The suite leaves the last test's changes on the `user` board.
- Frontend coverage is measured over `src/`, excluding test files and `src/app/layout.tsx` (fonts only).
- Tests never call the real AI, except the explicit live connectivity test in Part 8, which is skipped when no API key is set.
- Every part's success criteria include: coverage threshold met and all existing tests still passing.

---

## Part 1: Plan

- [x] Enrich this document with substeps, tests and success criteria for each part
- [x] Create `frontend/AGENTS.md` describing the existing frontend code
- [x] User reviews and approves this plan

Success criteria: user has approved the plan.

---

## Part 2: Scaffolding

- [x] `backend/pyproject.toml` managed by uv (fastapi, uvicorn; dev: pytest, pytest-cov, httpx2), commit `uv.lock`
- [x] `backend/app/main.py`: FastAPI app with `GET /api/health` returning `{"status": "ok"}`
- [x] Serve a placeholder `backend/static/index.html` ("hello world") at `/` that fetches `/api/health` and shows the result (removed in Part 3)
- [x] `Dockerfile` at repo root (`python:3.15-slim` + uv, runs uvicorn on port 8000)
- [x] `.dockerignore` (node_modules, .next, out, .venv, .env, db files)
- [x] `scripts/start.sh`, `scripts/stop.sh` (Mac/Linux) and `scripts/start.ps1`, `scripts/stop.ps1` (Windows): build image, run container with `--env-file .env` (only if `.env` exists), named volume `pm-data` at `/data`, port 8000; stop removes the container and keeps the volume
- [x] `.sh` scripts are POSIX `sh` (work with `sh`, `bash` or `./`); `.ps1` scripts check `$LASTEXITCODE` and do not use `ErrorActionPreference = Stop`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`; minimal root `README.md`

Tests:
- pytest: `/api/health` returns 200 and expected JSON; `/` returns the HTML page
- Coverage at least 80%

Success criteria:
- `scripts/start.sh` builds and starts the container; `http://localhost:8000/` shows hello world and the health result from the API
- `scripts/stop.sh` stops and removes the container
- Backend tests pass with coverage at least 80%

---

## Part 3: Add in Frontend

- [x] Set `output: "export"` in `next.config.ts`; `npm run build` produces `frontend/out/`
- [x] Dockerfile: add Node build stage; copy `out/` into the Python image; FastAPI serves it at `/` (remove the placeholder page)
- [x] Add card editing: edit title and details of an existing card inline (edit button on card, save/cancel), handled in `KanbanBoard` state
- [x] While a card is being edited, drag is disabled and the dnd-kit attributes are not applied (otherwise the form is exposed as disabled to assistive tech)
- [x] Fix pre-existing type errors in tests (`src/test/vitest.d.ts` references `vitest/globals`); ESLint ignores generated `coverage/`, `test-results/`, `playwright-report/`
- [x] Add `test:coverage` script and 80% thresholds to `vitest.config.ts`
- [x] Point Playwright `baseURL` at the container (`http://localhost:8000`, override with `BASE_URL`), drop the `next dev` webServer
- [x] Update `frontend/AGENTS.md`

Tests:
- Vitest: `moveCard` edge cases (same column to column end, missing ids, same position), `createId`, rename column, add/delete card, edit card (save and cancel), empty-title rejection in new card form
- Playwright: board loads at `/` from the container, add card, edit card, delete card, rename column, drag card between columns

Success criteria:
- Container serves the Kanban board at `/`
- Cards can be edited
- Frontend unit coverage at least 80%; all Playwright tests pass against the container

---

## Part 4: Fake user sign in

- [x] Backend: `POST /api/login` checks `user` / `password`, sets a signed httpOnly session cookie; `POST /api/logout` clears it; `GET /api/me` returns the username or 401
- [x] Session via Starlette `SessionMiddleware` (cookie `session`). Key from `SESSION_SECRET`; if unset, a random key is generated at startup, so a restart signs everyone out.
- [x] Backend: a dependency that resolves the current user from the cookie, used by all protected routes
- [x] Frontend: on load call `/api/me`; show a login form if 401, otherwise the board
- [x] Frontend: logout button in the header returns to the login form
- [x] Login form uses the project color scheme (purple submit button)

Tests:
- pytest: login success sets cookie, wrong credentials return 401, `/api/me` with and without cookie, logout clears session, tampered cookie rejected
- Vitest: login form renders, submits, shows error on failure, shows board on success, logout returns to form (fetch mocked)
- Playwright: visiting `/` shows login; wrong password shows error; correct login shows board; logout shows login; reload after login stays signed in

Success criteria:
- Board is not visible without signing in; sign in and out work end to end
- Coverage at least 80% for frontend and backend

---

## Part 5: Database modeling

- [x] Write `docs/DATABASE.md` describing the approach
- [x] Write `docs/schema.json` with the proposed schema
- [x] Proposed schema:
  - `users(id INTEGER PK, username TEXT UNIQUE, created_at TEXT)`
  - `boards(id INTEGER PK, user_id INTEGER UNIQUE FK users.id, data TEXT JSON, updated_at TEXT)`
  - `data` holds the full board in the frontend `BoardData` shape: `{columns: [{id, title, cardIds}], cards: {id: {id, title, details}}}`
  - One board per user for the MVP (`UNIQUE user_id`); dropping the constraint later allows multiple boards
- [x] Database created on startup if missing; the `user` row is created on first login and the default board on first board request
- [x] Column ids and order are fixed; only column titles can change (applies to UI and AI updates)
- [x] Plain `sqlite3`, no ORM
- [x] User sign-off

Tests: none (design only).

Success criteria: user has approved `docs/DATABASE.md` and `docs/schema.json`.

---

## Part 6: Backend

- [x] `backend/app/db.py`: sqlite3 connection, create tables if missing, path from `DB_PATH` env var (`/data/kanban.db` in Docker, `backend/data/kanban.db` locally; read on every connect)
- [x] `backend/app/board.py`: Pydantic models for `BoardData` (Card, Column, Board) shared by API and AI code, `DEFAULT_BOARD`, `validate_board`
- [x] New users get a deep copy of `DEFAULT_BOARD` (returning the shared object let one user's changes leak into later defaults)
- [x] `GET /api/board`: return the current user's board, creating the default board if none exists
- [x] `PUT /api/board`: validate and replace the current user's board
- [x] Validation (per `docs/DATABASE.md`): column ids and order unchanged (so always 5), every card in exactly one column (no duplicates, unknown or orphan cards), card key matches card id, non-empty card title; shape errors and rule errors both return 422 and nothing is saved
- [x] `*.db` and `backend/data/` git-ignored
- [x] Update `backend/AGENTS.md`

Tests:
- pytest with a temp database per test: db created when missing, default board on first GET, PUT then GET round trip, invalid board rejected (422), unauthenticated requests return 401, boards isolated between two users
- Coverage at least 80%

Success criteria:
- Board can be read and changed via the API for the signed-in user
- Deleting the db file and restarting recreates it
- Backend coverage at least 80%

---

## Part 7: Frontend + Backend

- [x] `frontend/src/lib/api.ts`: `getBoard`, `saveBoard` (added to `login`, `logout`, `getMe` from Part 4)
- [x] New `BoardScreen` loads the board from `/api/board` after sign in (loading state), holds it in state and saves changes; `KanbanBoard` is now controlled (`board` + `onChange`) instead of owning `initialData`
- [x] Every board change (move, rename, add, edit, delete) saves the full board via `PUT /api/board`
- [x] Saves are queued so they reach the server one at a time, in order (column rename saves on each keystroke); a failed save does not block later ones
- [x] Remove `initialData` from the frontend once the backend owns the default board (kept as `src/test/boardFixture.ts`; backend test checks the default board is valid)
- [x] Playwright runs with `workers: 1`; e2e board tests reset the board first; `restart.spec.ts` restarts the `pm-app` container and signs in again

Tests:
- Vitest: api client functions (fetch mocked), board loads from API, each mutation calls `saveBoard` with the expected board
- Playwright: add, edit, move, rename, delete, then reload and confirm each persisted; stop and start the container and confirm data persists

Success criteria:
- Board is persistent across page reloads and container restarts
- Coverage at least 80% for frontend and backend

---

## Part 8: AI connectivity

- [x] Add `openai` SDK to the backend; client with `base_url="https://openrouter.ai/api/v1"` and `OPENROUTER_API_KEY` (key in `pm/.env` is present and verified)
- [x] `backend/app/ai.py`: function to send messages to `openai/gpt-oss-120b` and return the reply
- [x] `POST /api/ai/test` (signed in) asks "What is 2+2?" and returns the reply
- [x] `python-dotenv` loads `pm/.env` at import time so `OPENROUTER_API_KEY` is available for local (non-Docker) runs too, matching Docker's `--env-file`

Tests:
- [x] pytest (mocked client): request sent with the correct model and messages, reply returned
- [x] pytest live test (marked, skipped without key): "2+2" reply contains "4"

Success criteria:
- [x] Live test passes against OpenRouter from inside the container
- [x] Coverage at least 80%

---

## Part 9: AI with the Kanban board

- [x] `POST /api/chat` takes `{message, history: [{role, content}]}`
- [x] Backend builds the prompt: system instructions, current board JSON, history, user message
- [x] Structured Outputs with a response schema `{reply: string, board: BoardData | null}` (cards sent to/from the model as a list, not the stored id-keyed dict, so the JSON schema can stay strict)
- [x] If `board` is returned, validate it with `validate_board` (same rules as Part 6, so the AI cannot add, remove or reorder columns) and save it; respond with `{reply, board}`
- [x] Invalid AI board is not saved; reply is still returned with an error note
- [x] Malformed AI output (bad JSON, missing keys, or a board that fails model validation) is caught and returns a fallback reply instead of a 500 - found via live Docker testing, where the model occasionally doesn't honor the schema strictly
- [x] One automatic retry on a malformed response before falling back - found via real user report ("AI assistant is not implementing changes"); root-caused to the model intermittently (roughly 5-15% of requests) not honoring `strict` schema compliance, confirmed by repeated live calls; the retry brought 10/10 live attempts to success in verification. Also strengthened the system prompt to forbid narrating a change ("Moved the card...") without including the updated `board` in the same response
- [x] `chat()` also validates the returned board against the fixed-column rules itself and retries on failure (not just on a JSON/shape failure) - found via a second real user report ("move all cards from backlog to discovery" -> rejected, "Columns are fixed"); root-caused to the model dropping unmentioned columns from its board response for bulk-move phrasing, reproduced at ~40% failure for that exact phrasing; the retry brought 10/10 live attempts to success in verification

Tests:
- [x] pytest (mocked AI): reply only leaves board unchanged; create, edit and move card updates are saved; multiple changes in one response; invalid board rejected and not saved; history is passed to the model; unauthenticated returns 401; malformed AI output handled gracefully
- [x] Live test (marked, skipped without key): ask to add a card, confirm it exists in the saved board

Success criteria:
- [x] AI can create, edit and move one or more cards through structured output
- [x] Coverage at least 80%

---

## Part 10: AI chat sidebar

- [x] `ChatSidebar` component: message list, input, send button (purple), loading indicator, collapsible
- [x] Conversation history kept in frontend state and sent with each request
- [x] When the response contains a board, replace the board state held in `BoardScreen` so the UI refreshes immediately
- [x] Styling follows the project color scheme; board remains usable with the sidebar open
- [x] `KanbanBoard`'s column grid changed from a fixed `grid-cols-5` to `grid-flow-col` with `auto-cols-[minmax(240px,1fr)]` and horizontal scroll - found via a live screenshot that the fixed grid squeezed columns too narrow once the sidebar took space, overflowing card buttons into the next column
- [x] Update `frontend/AGENTS.md` and `backend/AGENTS.md`

Tests:
- [x] Vitest: sends message with history, renders replies, shows loading and error states, board updates when response includes a board
- [x] Playwright (chat API route mocked via `page.route`): send a message, see the reply, board refreshes with the AI change

Success criteria:
- [x] User can chat with the AI in the sidebar; AI changes appear on the board without a reload
- [x] Coverage at least 80% for frontend and backend; all tests pass

---

## Open items

- Optional: send `Cache-Control: no-cache` for HTML so a browser never shows a stale page after an image rebuild (a stale cached page pointed at old CSS and showed the board unstyled once; a hard refresh fixed it)
- Optional: have the e2e suite restore the default board when it finishes
- Windows `.ps1` scripts have been reviewed but not run (no Windows host)
- Nothing has been committed yet; commit when the user asks
