# NSC: VR Video Monitoring System

This repo contains a Dockerized full-stack app:
- Backend (Node/Express, Sequelize, MySQL, MQTT)
- Frontend (Vite/React, built and served by Nginx)
- MQTT broker (Eclipse Mosquitto)
- MySQL database

Redis is not required and has been removed.

## Prerequisites
- Docker Desktop (or Docker Engine + Docker Compose V2)

## Quick start
1. Clone the project
```
git clone https://github.com/Neur-XR-Studios/NSC.git NSC
cd NSC
```

2. Configure environment
- Edit `./.env.docker` if needed. Defaults are provided. Key items:
  - `BACKEND_PORT=8001` (host port mapping for API)
  - `FRONTEND_PORT=8002` (host port mapping for UI)
  - `VITE_API_URL=http://localhost:8001/api` (frontend build-time API base URL)
  - `VITE_MQTT_WS_URL=ws://localhost:9001` (frontend MQTT WebSocket)

3. Build and start
```
docker compose --env-file .env.docker up -d --build
```

4. Access the app
- Frontend: http://localhost:${FRONTEND_PORT:-8002}
- Backend API: http://localhost:${BACKEND_PORT:-8001}
- MQTT WS: ws://localhost:9001

## Common commands
- Rebuild only frontend and restart:
```
docker compose --env-file .env.docker build frontend && \
  docker compose --env-file .env.docker up -d frontend
```
- Rebuild only backend and restart:
```
docker compose --env-file .env.docker build backend && \
  docker compose --env-file .env.docker up -d backend
```
- View backend logs:
```
docker compose logs -f backend
```
- Stop all:
```
docker compose down
```

## Ports and services
- Backend container listens on port 5000 internally; published as `${BACKEND_PORT}` (default 8001).
- Frontend container listens on port 80; published as `${FRONTEND_PORT}` (default 8002).
- Mosquitto WebSocket published on 9001 for browser access.
- MySQL is internal only (no host port published). Backend connects via `mysql` service name.

## Environment details
- Backend (`nsc-backend`) uses `.env.docker` (loaded via Compose `env_file`) for DB/MQTT/APP settings.
- Frontend (`nsc-frontend`) bakes Vite envs at build time via Compose build args:
  - `VITE_API_URL`
  - `VITE_MQTT_WS_URL`

If you change these, rebuild the frontend image.

## Troubleshooting
- Port conflict errors: change `BACKEND_PORT` or `FRONTEND_PORT` in `.env.docker` and rerun the up command.
- Frontend still calls wrong API URL: ensure `VITE_API_URL` is correct and rebuild frontend. Hard-refresh the browser.
- CORS/Network errors on HTTPS: use HTTP locally (`http://localhost:8001/api`). The backend does not serve HTTPS by default.

## Repository hygiene
- See root `.gitignore` for ignored paths. Uploaded/generated assets are not committed:
  - `nsc-backend/src/public/audio/`
  - `nsc-backend/src/public/telemetry/`
  - `nsc-backend/src/public/thumbnails/`
  - `nsc-backend/src/public/video/`
- `.env.docker` is allowed to be committed for reproducible Docker runs. Do NOT commit secrets.

## License
Proprietary. All rights reserved.
