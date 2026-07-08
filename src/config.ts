export interface ObservabilityConfig {
  appName: string;
  environment: string;
  pushover: {
    token: string;
    user: string;
    device?: string;
    enabled: boolean;
  };
  syslog: {
    host: string;
    port: number;
    protocol: "udp4" | "tcp4" | "tls4";
    enabled: boolean;
  };
  console: {
    enabled: boolean;
    level: string;
  };
}

export function loadConfig(overrides: Partial<ObservabilityConfig> = {}): ObservabilityConfig {
  const env = process.env;
  const appName = overrides.appName ?? env.APP_NAME ?? "unknown-app";
  const pushoverToken = overrides.pushover?.token ?? env.PUSHOVER_TOKEN ?? "";
  const pushoverUser = overrides.pushover?.user ?? env.PUSHOVER_USER ?? "";
  const syslogHost = overrides.syslog?.host ?? env.SYSLOG_HOST ?? "";

  // Auto-disable transports when their endpoint isn't configured.
  // Caller can still force-enable via explicit `enabled: true` after providing config.
  const pushoverEnabled =
    overrides.pushover?.enabled ??
    (env.PUSHOVER_ENABLED !== "false" && pushoverToken !== "" && pushoverUser !== "");
  const syslogEnabled = overrides.syslog?.enabled ?? (env.SYSLOG_ENABLED !== "false" && syslogHost !== "");

  return {
    appName,
    environment: overrides.environment ?? env.NODE_ENV ?? "development",
    pushover: {
      token: pushoverToken,
      user: pushoverUser,
      device: overrides.pushover?.device ?? env.PUSHOVER_DEVICE,
      enabled: pushoverEnabled,
    },
    syslog: {
      host: syslogHost,
      port: overrides.syslog?.port ?? parseInt(env.SYSLOG_PORT ?? "514", 10),
      protocol: (overrides.syslog?.protocol ?? env.SYSLOG_PROTOCOL ?? "udp4") as "udp4" | "tcp4" | "tls4",
      enabled: syslogEnabled,
    },
    console: {
      enabled: overrides.console?.enabled ?? env.CONSOLE_LOG_ENABLED !== "false",
      level: overrides.console?.level ?? env.LOG_LEVEL ?? "info",
    },
  };
}
