# Redis Insight UI

A Redis Insight style desktop web app built with Vite and React.

The browser UI talks to Redis through a small local Node HTTP proxy in `scripts/redis-api-server.mjs`. Browsers cannot open raw TCP connections to Redis directly, so both processes are required during development.

## Run

```bash
npm run redis-api
npm run dev -- --host 0.0.0.0
```

Default Redis target:

```text
127.0.0.1:6379 db0
```

You can change host, port, db, and password from the top connection bar.

## Build

```bash
npm run build
```

## Current Features

- Connect/disconnect Redis status
- SCAN-based key browser with type filtering
- Value preview for string, list, set, zset, and hash keys
- Redis CLI command execution
- Command helper
- Command history/profiler panel

Mutating CLI commands run against the connected Redis database.
