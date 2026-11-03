# Database

SQLite, accessed with Python's built-in `sqlite3`. The full schema is in `schema.json`.

## Approach

Each user's board is stored as one JSON document in `boards.data`, in the same `BoardData` shape the frontend already uses (`{columns, cards}`). The backend reads and writes the whole board at once.

Why a JSON document instead of separate column and card tables:

- The frontend and the AI both work with the whole board as JSON, so there is no mapping layer
- Every change is a single row update, so the board can never be half-saved
- One board per user is small, so rewriting it on every change is cheap

## Tables

- `users(id, username UNIQUE, created_at)`
- `boards(id, user_id UNIQUE -> users.id, data, updated_at)`

`UNIQUE user_id` enforces one board per user for the MVP. Removing that constraint and adding a board name would allow several boards per user later without changing the data format.

## Lifecycle

- Database file path comes from `DB_PATH` (in Docker: `/data/kanban.db` on the `pm-data` volume). The file and tables are created at startup if missing (`CREATE TABLE IF NOT EXISTS`).
- The `users` row is created on first successful login.
- The default board (the current demo board: 5 columns, 8 cards) is created the first time a user's board is requested.
- Foreign keys are enabled per connection (`PRAGMA foreign_keys = ON`).

## Validation

Every board saved through the API, whether from the UI or the AI, is checked before writing:

- It matches the JSON schema in `schema.json` (Pydantic models in the backend)
- There are exactly 5 columns, and their ids and order match the stored board. Columns are fixed: only titles can change.
- Every id in a column's `cardIds` exists in `cards`, and each card's `id` matches its key
- Every card appears in exactly one column (no duplicates, no orphan cards)
- Card titles are not empty

Invalid boards are rejected with 422 and nothing is written.
