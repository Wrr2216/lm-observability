export interface ObservabilityConfig {
  appName: string;
  environment: string;
  ntfy: {
    url: string;
    topic: string;
    token?: string;
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
  const ntfyTopic = overrides.ntfy?.topic ?? env.NTFY_TOPIC ?? appName;

  return {
    appName,
    environment: overrides.environment ?? env.NODE_ENV ?? "development",
    ntfy: {
      url: overrides.ntfy?.url ?? env.NTFY_URL ?? "https://ntfy.lm3114.com",
      topic: ntfyTopic,
      token: overrides.ntfy?.token ?? env.NTFY_TOKEN,
      enabled: overrides.ntfy?.enabled ?? env.NTFY_ENABLED !== "false",
    },
    syslog: {
      host: overrides.syslog?.host ?? env.SYSLOG_HOST ?? "192.168.10.58",
      port: overrides.syslog?.port ?? parseInt(env.SYSLOG_PORT ?? "514", 10),
      protocol: (overrides.syslog?.protocol ?? env.SYSLOG_PROTOCOL ?? "udp4") as "udp4" | "tcp4" | "tls4",
      enabled: overrides.syslog?.enabled ?? env.SYSLOG_ENABLED !== "false",
    },
    console: {
      enabled: overrides.console?.enabled ?? env.CONSOLE_LOG_ENABLED !== "false",
      level: overrides.console?.level ?? env.LOG_LEVEL ?? "info",
    },
  };
}
