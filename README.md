# lm-observability

Drop-in observability for Logan's Node/TypeScript projects:

- **ntfy notifications** — build start/success/failure, app startup/shutdown/crash
- **Syslog log shipping** — all logs forwarded to the homelab syslog server via `winston-syslog`
- **CI/CD templates** — GitHub Actions workflow that builds, pushes to Docker Hub (`loganmct/*`), and notifies ntfy

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

| Var               | Default                       | Purpose                          |
| ----------------- | ----------------------------- | -------------------------------- |
| `APP_NAME`        | `unknown-app`                 | App name (used in titles & topic) |
| `NODE_ENV`        | `development`                 | Environment label                |
| `NTFY_URL`        | `https://ntfyurl`     | ntfy base URL                    |
| `NTFY_TOPIC`      | `${APP_NAME}`                 | Topic to publish to              |
| `NTFY_TOKEN`      | —                             | Bearer token (if topic protected) |
| `NTFY_ENABLED`    | `true`                        | `false` disables ntfy            |
| `SYSLOG_HOST`     | `syslog address`               | Syslog server                    |
| `SYSLOG_PORT`     | `514`                         | Syslog port                      |
| `SYSLOG_PROTOCOL` | `udp4`                        | `udp4` / `tcp4` / `tls4`         |
| `SYSLOG_ENABLED`  | `true`                        | `false` disables syslog          |
| `LOG_LEVEL`       | `info`                        | Winston log level                |
| `CONSOLE_LOG_ENABLED` | `true`                    | `false` disables console output  |

## API

### `init(opts)`

Returns `{ config, logger, ntfy }`. Overrides any env-var default.

```ts
init({
  appName: "api",
  ntfy: { topic: "api-prod", enabled: true },
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

Standard [Winston](https://github.com/winstonjs/winston) logger. Logs go to console (pretty) and syslog (RFC5424 JSON).

## CI/CD template

Copy `templates/docker-publish.yml` into `.github/workflows/` in any project. It will:

1. Notify ntfy when build starts
2. Build a multi-arch image
3. Push to `docker.io/loganmct/<repo-name>` with semver / sha / branch tags
4. Notify ntfy with the digest on success, or the failed run URL on failure

Required GitHub secrets in the consuming repo:

- `DOCKERHUB_TOKEN` — Docker Hub access token
- `NTFY_TOKEN` — optional, only if your ntfy topic requires auth

Optional GitHub vars:

- `DOCKERHUB_USERNAME`
- `NTFY_URL` (default `https://ntfyurl`)
- `NTFY_TOPIC` (default repo name)

A starter `Dockerfile.example` is included in `templates/`.

## Releasing this package

Tag a version and push:

```bash
npm version patch
git push --follow-tags
```

The bundled `publish.yml` workflow builds and publishes to npm with provenance. Requires `NPM_TOKEN` secret in the repo.
