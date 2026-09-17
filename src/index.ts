import { loadConfig, type ObservabilityConfig } from "./config";
import { PushoverClient } from "./pushover";
import { createLogger } from "./logger";
import { registerLifecycle } from "./lifecycle";
import type winston from "winston";

export interface Observability {
  config: ObservabilityConfig;
  logger: winston.Logger;
  pushover: PushoverClient;
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
  const pushover = new PushoverClient(config.pushover, config.appName);

  if (autoLifecycle) {
    registerLifecycle({ pushover, logger, appMeta, onShutdown });
  }

  return { config, logger, pushover };
}

export { PushoverClient } from "./pushover";
export { createLogger } from "./logger";
export { loadConfig } from "./config";
export { registerLifecycle } from "./lifecycle";
export type { ObservabilityConfig } from "./config";
export type { PushoverMessage, PushoverPriority } from "./pushover";
export { sendWazuh, formatAlert } from "./wazuh";
export type { AlertEvent } from "./wazuh";
