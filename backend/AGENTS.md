# Backend

Python FastAPI app, managed with uv (Python 3.15, pinned in `.python-version`).

## Structure

- `app/board.py` - Pydantic models `Card`, `Column`, `Board` (same shape as the frontend `BoardData`), `DEFAULT_BOARD`, and `validate_board(board, current)` which enforces the rules in `docs/DATABASE.md`
- `app/db.py` - SQLite via `sqlite3`: `init_db`, `get_or_create_user`, `get_board` (creates the default board on first read), `save_board`. Path from `DB_PATH` (default `backend/data/kanban.db`), read on every connect so tests can override it.
- `app/ai.py` - `ask(message)` sends a single user message to OpenRouter (`openai/gpt-oss-120b`) and returns the reply text. `chat(message, history, board)` sends a system prompt (board management instructions + current board JSON), history, and the user message, using Structured Outputs (`response_format` json_schema, strict) for a `{reply, board}` response; returns a `ChatResult`. Cards are sent to/from the model as a list (`_board_to_wire` / `_wire_to_board`) rather than the stored id-keyed dict, since a strict JSON schema needs fixed property names. The model occasionally does not honor the strict schema (bad JSON, missing keys, a board that fails Pydantic validation, or - most commonly - a syntactically valid board that silently drops columns, e.g. "move all cards from X to Y" prompts) despite `strict: True`; `chat` validates the board against the fixed-column rules itself (`validate_board`) and retries once (`MAX_ATTEMPTS`) on any of these failures before falling back to a generic reply with no board change. Loads `pm/.env` with `python-dotenv` at import time (a no-op if the file is absent, e.g. in Docker where `--env-file` already set the variable); reads `OPENROUTER_API_KEY` from the environment.
- `app/main.py` - FastAPI app; creates the database on startup (lifespan). API routes live under `/api`. Static files from `STATIC_DIR` (env var, default `backend/static`) are mounted at `/` last, so API routes take precedence.
- Static site: the Next.js export (`frontend/out`). In Docker it is copied to `/app/static`; for local runs set `STATIC_DIR=../frontend/out` after `npm run build`.
- `tests/` - pytest tests. `conftest.py` points `STATIC_DIR` at a temp dir with a stub `index.html`, gives every test its own temp `DB_PATH`, and provides `client` (runs startup) and `signed_in` fixtures.

## Routes

- `GET /api/health` - `{"status": "ok"}`
- `POST /api/login` - body `{username, password}`; only `user` / `password` is accepted (401 otherwise). Stores the username in the session.
- `POST /api/logout` - clears the session
- `GET /api/me` - `{username}` or 401
- `GET /api/board` - current user's board (401 if signed out)
- `PUT /api/board` - replace the current user's board; 422 if invalid (nothing is saved)
- `POST /api/ai/test` - asks the AI "What is 2+2?" and returns `{reply}` (401 if signed out)
- `POST /api/chat` - body `{message, history: [{role, content}]}`; the AI's board changes (if any and if valid) are saved; returns `{reply, board}` (`board` is `null` when nothing changed or the AI's proposed board was rejected) (401 if signed out)

## Auth

Starlette `SessionMiddleware` keeps the session in a signed, httpOnly cookie named `session`. The signing key comes from `SESSION_SECRET`; if unset, a random key is generated at startup, so restarting the server signs everyone out. Protected routes depend on `current_user`, which returns the username or raises 401.

## Commands

- `uv sync` - install dependencies
- `uv run pytest` - run tests with coverage (fails below 80%); includes a `live` marker that hits the real OpenRouter API and is skipped unless `OPENROUTER_API_KEY` is set (loaded from `pm/.env` automatically)
- `uv run pytest -m "not live"` - skip the live AI test explicitly
- `STATIC_DIR=../frontend/out uv run uvicorn app.main:app --reload` - run locally on port 8000

## Docker

The root `Dockerfile` builds the frontend in a Node stage, then builds the Python image with `uv sync --frozen --no-dev` and runs uvicorn on port 8000. `DB_PATH=/data/kanban.db`, on the named volume `pm-data`. See `docs/DATABASE.md` for the schema.
