# Frontend

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, dnd-kit for drag and drop. Built as a static export (`output: "export"` -> `out/`) and served by the FastAPI backend at `/`. Requires the backend: sign in and the board are loaded from and saved to the API.

## Structure

- `src/app/layout.tsx` - root layout; loads fonts via `next/font/google` (Space Grotesk as `--font-display`, Manrope as `--font-body`). Fonts are fetched at build time, so builds need network access.
- `src/app/page.tsx` - renders `AuthGate`
- `src/components/AuthGate.tsx` - calls `/api/me` on load; shows `LoginForm` when signed out, `BoardScreen` when signed in; handles login and logout
- `src/components/BoardScreen.tsx` - loads the board with `getBoard` (shows a loading state), holds it in state, and saves every change with `saveBoard`
- `src/components/LoginForm.tsx` - username/password form; shows an error on failed sign in
- `src/lib/api.ts` - fetch wrappers: `getMe`, `login`, `logout`, `getBoard`, `saveBoard`. Saves are queued so they reach the server one at a time, in order; a failed save does not block later ones.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface, stroke, shadow)
- `src/lib/kanban.ts` - data model and pure logic
  - Types: `Card {id, title, details}`, `Column {id, title, cardIds}`, `BoardData {columns, cards}` (cards keyed by id, order held in `column.cardIds`)
  - `moveCard(columns, activeId, overId)` - reorder within a column or move across columns; `overId` may be a card id or a column id (drop at end)
  - `createId(prefix)` - random id generator
- `src/components/KanbanBoard.tsx` - controlled: takes `board` and reports every change through `onChange` (full next board); header has a Log out button (`onLogout`); handlers for drag end, rename column, add, edit and delete card; wraps columns in `DndContext` with a `DragOverlay`
- `src/components/KanbanColumn.tsx` - droppable column; title is an editable input (aria-label "Column title"); renders sortable cards and `NewCardForm`
- `src/components/KanbanCard.tsx` - sortable card with Edit and Remove buttons; Edit switches to an inline form (title required). While editing, drag is disabled and the dnd-kit attributes are not applied, otherwise the form is exposed as disabled to assistive tech.
- `src/components/KanbanCardPreview.tsx` - static card shown in the drag overlay
- `src/components/NewCardForm.tsx` - toggleable form to add a card (title required, details optional)

## Tests

- Unit (Vitest + Testing Library, jsdom): `src/**/*.test.{ts,tsx}`. Coverage thresholds of 80% are enforced in `vitest.config.ts`. `src/test/boardFixture.ts` is a copy of the backend default board; `fetch` is mocked with `vi.spyOn(globalThis, "fetch")`.
- E2E (Playwright, `tests/`): runs against the Docker container at `http://localhost:8000` (override with `BASE_URL`). Start it first with `scripts/start.sh`. `tests/helpers.ts` has `signIn`, `signInToBoard`, `signInWithFreshBoard` (resets the board to the fixture, since data persists) and `waitForSave` (register it before the action that saves). Runs with one worker because all tests share one user and board. `restart.spec.ts` restarts the `pm-app` container.
- Next.js renders an empty `role="alert"` route announcer, so match alerts by text, not by role alone.
- Test ids: columns use `column-<id>`, cards use `card-<id>`. Cards carry `role="button"` from dnd-kit, so match card buttons by exact name in Playwright.

## Commands

- `npm run dev` - dev server (no backend, so sign in will not work)
- `npm run build` - static export to `out/`
- `npm run test:coverage` - unit tests with coverage
- `npm run test:e2e` - Playwright (container must be running)
- `npm run lint` - ESLint
