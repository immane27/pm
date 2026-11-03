# Kanban Studio

Project management Kanban app with an AI assistant. Runs locally in Docker.

## Run

Put `OPENROUTER_API_KEY=...` in `.env`, then:

- Mac/Linux: `scripts/start.sh`, stop with `scripts/stop.sh`
- Windows: `scripts\start.ps1`, stop with `scripts\stop.ps1`

Open http://localhost:8000

## Tests

- Backend: `cd backend && uv run pytest`
- Frontend unit: `cd frontend && npm run test:coverage`
- Frontend e2e (container running): `cd frontend && npm run test:e2e`
