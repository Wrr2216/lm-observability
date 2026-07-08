import type { ObservabilityConfig } from "./config";

export type PushoverPriority = "min" | "low" | "default" | "high" | "max";

// Pushover uses numeric priorities from -2 (lowest) to 2 (emergency).
const PRIORITY_MAP: Record<PushoverPriority, number> = {
  min: -2,
  low: -1,
  default: 0,
  high: 1,
  max: 2,
};

export interface PushoverMessage {
  title?: string;
  message: string;
  priority?: PushoverPriority;
  sound?: string;
  url?: string;
  urlTitle?: string;
}

const API_URL = "https://api.pushover.net/1/messages.json";

export class PushoverClient {
  constructor(private readonly cfg: ObservabilityConfig["pushover"], private readonly appName: string) {}

  async send(msg: PushoverMessage): Promise<void> {
    if (!this.cfg.enabled) return;

    const priority = PRIORITY_MAP[msg.priority ?? "default"];
    const body: Record<string, string | number> = {
      token: this.cfg.token,
      user: this.cfg.user,
      title: msg.title ?? this.appName,
      message: msg.message,
      priority,
    };
    if (this.cfg.device) body.device = this.cfg.device;
    if (msg.sound) body.sound = msg.sound;
    if (msg.url) body.url = msg.url;
    if (msg.urlTitle) body.url_title = msg.urlTitle;
    if (priority === 2) {
      // Emergency priority requires retry/expire; re-alerts every 60s for up to 1h until acked.
      body.retry = 60;
      body.expire = 3600;
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`[lm-observability] pushover failed: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error(`[lm-observability] pushover error:`, err);
    }
  }

  buildStart(version?: string): Promise<void> {
    return this.send({
      title: `${this.appName} build started`,
      message: `Build started${version ? ` for ${version}` : ""}`,
      priority: "low",
    });
  }

  buildSuccess(version?: string, durationMs?: number): Promise<void> {
    const duration = durationMs ? ` in ${(durationMs / 1000).toFixed(1)}s` : "";
    return this.send({
      title: `${this.appName} build succeeded`,
      message: `Build succeeded${version ? ` for ${version}` : ""}${duration}`,
      priority: "default",
    });
  }

  buildFailure(error: string, version?: string): Promise<void> {
    return this.send({
      title: `${this.appName} build FAILED`,
      message: `Build failed${version ? ` for ${version}` : ""}\n${error}`,
      priority: "high",
    });
  }

  appStarted(meta?: Record<string, unknown>): Promise<void> {
    return this.send({
      title: `${this.appName} started`,
      message: `Application started${meta ? `\n${JSON.stringify(meta, null, 2)}` : ""}`,
      priority: "low",
    });
  }

  appStopped(reason?: string): Promise<void> {
    return this.send({
      title: `${this.appName} stopped`,
      message: `Application stopped${reason ? `: ${reason}` : ""}`,
      priority: "low",
    });
  }

  appCrashed(error: Error | string): Promise<void> {
    const msg = error instanceof Error ? `${error.message}\n${error.stack}` : error;
    return this.send({
      title: `${this.appName} CRASHED`,
      message: msg,
      priority: "high",
    });
  }
}
