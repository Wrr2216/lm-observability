import type { ObservabilityConfig } from "./config";

export type NtfyPriority = "min" | "low" | "default" | "high" | "max";

export interface NtfyMessage {
  title?: string;
  message: string;
  priority?: NtfyPriority;
  tags?: string[];
  click?: string;
  actions?: string;
}

export class NtfyClient {
  constructor(private readonly cfg: ObservabilityConfig["ntfy"], private readonly appName: string) {}

  async send(msg: NtfyMessage): Promise<void> {
    if (!this.cfg.enabled) return;

    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      Title: msg.title ?? this.appName,
    };
    if (msg.priority) headers.Priority = msg.priority;
    if (msg.tags?.length) headers.Tags = msg.tags.join(",");
    if (msg.click) headers.Click = msg.click;
    if (msg.actions) headers.Actions = msg.actions;
    if (this.cfg.token) headers.Authorization = `Bearer ${this.cfg.token}`;

    const url = `${this.cfg.url.replace(/\/$/, "")}/${this.cfg.topic}`;

    try {
      const res = await fetch(url, { method: "POST", headers, body: msg.message });
      if (!res.ok) {
        console.error(`[lm-observability] ntfy failed: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error(`[lm-observability] ntfy error:`, err);
    }
  }

  buildStart(version?: string): Promise<void> {
    return this.send({
      title: `${this.appName} build started`,
      message: `Build started${version ? ` for ${version}` : ""}`,
      tags: ["hammer_and_wrench"],
      priority: "low",
    });
  }

  buildSuccess(version?: string, durationMs?: number): Promise<void> {
    const duration = durationMs ? ` in ${(durationMs / 1000).toFixed(1)}s` : "";
    return this.send({
      title: `${this.appName} build succeeded`,
      message: `Build succeeded${version ? ` for ${version}` : ""}${duration}`,
      tags: ["white_check_mark"],
      priority: "default",
    });
  }

  buildFailure(error: string, version?: string): Promise<void> {
    return this.send({
      title: `${this.appName} build FAILED`,
      message: `Build failed${version ? ` for ${version}` : ""}\n${error}`,
      tags: ["x", "rotating_light"],
      priority: "high",
    });
  }

  appStarted(meta?: Record<string, unknown>): Promise<void> {
    return this.send({
      title: `${this.appName} started`,
      message: `Application started${meta ? `\n${JSON.stringify(meta, null, 2)}` : ""}`,
      tags: ["rocket"],
      priority: "low",
    });
  }

  appStopped(reason?: string): Promise<void> {
    return this.send({
      title: `${this.appName} stopped`,
      message: `Application stopped${reason ? `: ${reason}` : ""}`,
      tags: ["octagonal_sign"],
      priority: "low",
    });
  }

  appCrashed(error: Error | string): Promise<void> {
    const msg = error instanceof Error ? `${error.message}\n${error.stack}` : error;
    return this.send({
      title: `${this.appName} CRASHED`,
      message: msg,
      tags: ["boom", "rotating_light"],
      priority: "max",
    });
  }
}
