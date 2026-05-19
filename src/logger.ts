import winston from "winston";
import "winston-syslog";
import type { ObservabilityConfig } from "./config";

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

  return winston.createLogger({
    level: cfg.console.level,
    defaultMeta: { app: cfg.appName, env: cfg.environment },
    transports,
    exitOnError: false,
  });
}
