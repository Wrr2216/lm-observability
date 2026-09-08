import winston from "winston";
import "winston-syslog";
import type { ObservabilityConfig } from "./config";
import { sendWazuh } from "./wazuh";

export function createLogger(cfg: ObservabilityConfig): winston.Logger {
  const transports: winston.transport[] = [];

  if (cfg.console.enabled) {
    transports.push(
      new winston.transports.Console({
        level: cfg.console.level,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
            return `${timestamp} [${level}] ${message}${metaStr}`;
          }),
        ),
      }),
    );
  }

  if (cfg.syslog.enabled) {
    const Syslog = (winston.transports as unknown as { Syslog: new (opts: object) => winston.transport }).Syslog;
    transports.push(
      new Syslog({
        host: cfg.syslog.host,
        port: cfg.syslog.port,
        protocol: cfg.syslog.protocol,
        app_name: cfg.appName,
        localhost: require("os").hostname(),
        facility: "local0",
        type: "RFC5424",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );
  }

  const logger = winston.createLogger({
    level: cfg.console.level,
    defaultMeta: { app: cfg.appName, env: cfg.environment },
    transports,
    exitOnError: false,
  });
  // Mirror operational warnings/errors as bounded alert messages. Metadata is
  // deliberately excluded: it can contain request bodies, tokens or PII.
  logger.on("data", (info: { level: string; message: unknown; event_type?: string }) => {
    // The app's alert adapter sends these through PushoverClient separately.
    if (info.event_type === "app_alert") return;
    if (info.level !== "warn" && info.level !== "error") return;
    void sendWazuh({ app: cfg.appName, title: `${cfg.appName}: ${info.level}`,
      message: String(info.message), priority: info.level === "error" ? 1 : 0 });
  });
  logger.on("error", () => console.error("[lm-observability] log transport failed"));
  return logger;
}
