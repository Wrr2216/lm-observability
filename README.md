# @loganmct/lm-observability

Drop-in observability for Node/TypeScript projects:

- **ntfy notifications** — build start/success/failure, app startup/shutdown/crash
- **Syslog log shipping** — all logs forwarded to a syslog server via `winston-syslog`
- **CI/CD templates** — GitHub Actions workflow that builds, pushes to Docker Hub, and notifies ntfy

> No infrastructure endpoints are baked into this package. Both ntfy and syslog auto-disable unless you configure them (env var or `init()` override).

## Install

```bash
npm install @loganmct/lm-observability
```

## Quick start

```ts
import { init } from "@loganmct/lm-observability";

const { logger, ntfy } = init({
  appName: "my-service",
  appMeta: { version: process.env.APP_VERSION },
});

logger.info("server up", { port: 3000 });

// Manual notifications
await ntfy.send({ message: "Backup complete", tags: ["floppy_disk"] });
```

`init()` auto-registers signal handlers and sends an `appStarted` ntfy on boot, `appStopped` on SIGTERM/SIGINT, and `appCrashed` on uncaught exceptions / unhandled rejections.

## Config (env vars)

| Var                   | Default        | Purpose                                                  |
| --------------------- | -------------- | -------------------------------------------------------- |
| `APP_NAME`            | `unknown-app`  | App name (used in titles & default ntfy topic)           |
| `NODE_ENV`            | `development`  | Environment label                                        |
| `NTFY_URL`            | _(unset)_      | ntfy base URL — **required to enable ntfy**              |
| `NTFY_TOPIC`          | `${APP_NAME}`  | Topic to publish to                                      |
| `NTFY_TOKEN`          | _(unset)_      | Bearer token (if topic protected)                        |
| `NTFY_ENABLED`        | auto           | Auto-disabled when `NTFY_URL` is empty; set `false` to force-off |
| `SYSLOG_HOST`         | _(unset)_      | Syslog server — **required to enable syslog shipping**   |
| `SYSLOG_PORT`         | `514`          | Syslog port                                              |
| `SYSLOG_PROTOCOL`     | `udp4`         | `udp4` / `tcp4` / `tls4`                                 |
| `SYSLOG_ENABLED`      | auto           | Auto-disabled when `SYSLOG_HOST` is empty; set `false` to force-off |
| `LOG_LEVEL`           | `info`         | Winston log level                                        |
| `CONSOLE_LOG_ENABLED` | `true`         | `false` disables console output                          |

## API

### `init(opts)`

Returns `{ config, logger, ntfy }`. Overrides any env-var default.

```ts
init({
  appName: "api",
  ntfy: { url: "https://ntfy.example.com", topic: "api-prod" },
  syslog: { host: "10.0.0.5", protocol: "tcp4" },
  autoLifecycle: true,
  onShutdown: async () => { await db.close(); },
});
```

### `ntfy` client

```ts
ntfy.buildStart(version?)
ntfy.buildSuccess(version?, durationMs?)
ntfy.buildFailure(error, version?)
ntfy.appStarted(meta?)
ntfy.appStopped(reason?)
ntfy.appCrashed(error)
ntfy.send({ title, message, priority, tags, click, actions })
```

### `logger`

Standard [Winston](https://github.com/winstonjs/winston) logger. Logs go to console (pretty) and syslog (RFC5424 JSON) when configured.

## CI/CD template

Copy `templates/docker-publish.yml` into `.github/workflows/` in any project. It will:

1. Notify ntfy when build starts (if `NTFY_URL` is set)
2. Build the image
3. Push to `docker.io/<DOCKERHUB_USERNAME>/<repo-name>` with semver / sha / branch tags
4. Notify ntfy with the digest on success, or the failed run URL on failure

**Required** GitHub repo variables (Settings → Secrets and variables → Actions → Variables):

- `DOCKERHUB_USERNAME`

**Required** GitHub repo secrets:

- `DOCKERHUB_TOKEN` — Docker Hub access token

**Optional**:

- `NTFY_URL` (var) — base URL of your ntfy server; omit to skip notifications
- `NTFY_TOPIC` (var) — defaults to repo name
- `NTFY_TOKEN` (secret) — if your topic requires auth

A starter `Dockerfile.example` is included in `templates/`. It deliberately sets no observability env vars — provide them via your orchestrator (Docker Compose, Dockge stack `.env`, Kubernetes ConfigMap, etc.).

## Releasing this package

Tag a version and push:

```bash
npm version patch
git push --follow-tags
```

The bundled `.github/workflows/publish.yml` builds and publishes to npm with provenance. Requires `NPM_TOKEN` secret in the repo.
