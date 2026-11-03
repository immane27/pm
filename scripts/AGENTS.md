# Scripts

Start and stop the app in Docker. Run from anywhere; scripts change to the repo root.

- `start.sh` / `start.ps1` - build image `pm-app`, replace any existing `pm-app` container, run it on port 8000 with volume `pm-data` at `/data`, and pass `.env` if present
- `stop.sh` / `stop.ps1` - remove the `pm-app` container (the volume is kept)

`.sh` is for Mac and Linux, `.ps1` for Windows PowerShell.
