#!/bin/sh
set -e
cd "$(dirname "$0")/.."

docker build -t pm-app .
docker rm -f pm-app >/dev/null 2>&1 || true

env_file=""
if [ -f .env ]; then
  env_file="--env-file .env"
fi

docker run -d --name pm-app -p 8000:8000 -v pm-data:/data $env_file pm-app
echo "Running at http://localhost:8000"
