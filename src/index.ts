import { loadConfig, type ObservabilityConfig } from "./config";
import { NtfyClient } from "./ntfy";
import { createLogger } from "./logger";
import { registerLifecycle } from "./lifecycle";
import type winston from "winston";

export interface Observability {
  config: ObservabilityConfig;
  logger: winston.Logger;
  ntfy: NtfyClient;
}

export interface InitOptions extends Partial<ObservabilityConfig> {
  autoLifecycle?: boolean;
  appMeta?: Record<string, unknown>;
  onShutdown?: () => Promise<void> | void;
}

export function init(opts: InitOptions = {}): Observability {
  const { autoLifecycle = true, appMeta, onShutdown, ...overrides } = opts;
  const config = loadConfig(overrides);
  const logger = createLogger(config);
  const ntfy = new NtfyClient(config.ntfy, config.appName);

  if (autoLifecycle) {
    registerLifecycle({ ntfy, logger, appMeta, onShutdown });
  }

  return { config, logger, ntfy };
}

export { NtfyClient } from "./ntfy";
export { createLogger } from "./logger";
export { loadConfig } from "./config";
export { registerLifecycle } from "./lifecycle";
export type { ObservabilityConfig } from "./config";
export type { NtfyMessage, NtfyPriority } from "./ntfy";
