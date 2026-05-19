import type winston from "winston";
import type { NtfyClient } from "./ntfy";

export interface LifecycleOptions {
  ntfy: NtfyClient;
  logger: winston.Logger;
  appMeta?: Record<string, unknown>;
  onShutdown?: () => Promise<void> | void;
}

export function registerLifecycle(opts: LifecycleOptions): void {
  const { ntfy, logger, appMeta, onShutdown } = opts;
  let shuttingDown = false;

  const meta = {
    pid: process.pid,
    node: process.version,
    ...appMeta,
  };

  void ntfy.appStarted(meta);
  logger.info("application started", meta);

  const shutdown = async (reason: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`shutting down: ${reason}`);
    try {
      if (onShutdown) await onShutdown();
      await ntfy.appStopped(reason);
    } catch (err) {
      logger.error("shutdown handler error", { err });
    }
    setTimeout(() => process.exit(exitCode), 250).unref();
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error("uncaughtException", { err: err.message, stack: err.stack });
    void ntfy.appCrashed(err).finally(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error("unhandledRejection", { err: err.message, stack: err.stack });
    void ntfy.appCrashed(err).finally(() => process.exit(1));
  });
}
