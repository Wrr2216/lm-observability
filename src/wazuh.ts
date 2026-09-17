import { createSocket } from "node:dgram";
import { createConnection } from "node:net";
import { hostname } from "node:os";

export interface AlertEvent {
  app: string;
  title: string;
  message: string;
  priority: number;
}

/** RFC3164 envelope with a JSON payload decoded by wazuh/decoders/mct-alert.xml. */
export function formatAlert(event: AlertEvent, date = new Date()): string {
  const severity = event.priority >= 1 ? 3 : event.priority < 0 ? 6 : 5;
  const stamp = date.toUTCString().slice(8, 11) + " " + String(date.getUTCDate()).padStart(2, " ") + " " + date.toISOString().slice(11, 19);
  const host = hostname().replace(/[^A-Za-z0-9_.-]/g, "_");
  return `<${128 + severity}>${stamp} ${host} mct-alert: ${JSON.stringify({
    ...event, app: event.app.slice(0, 128),
    title: Array.from(event.title).slice(0, 250).join(""),
    message: Array.from(event.message).slice(0, 1024).join(""),
    event: "notification", ts: date.toISOString(),
  })}`;
}

/** Bounded, best-effort delivery. No credentials or HTTP management API needed. */
export async function sendWazuh(event: AlertEvent): Promise<boolean> {
  const host = process.env.WAZUH_HOST?.trim();
  if (!host || process.env.WAZUH_ENABLED === "false") return false;
  const port = Number(process.env.WAZUH_PORT || "514");
  const protocol = process.env.WAZUH_PROTOCOL || "tcp";
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !["tcp", "udp", "tcp4", "udp4"].includes(protocol)) {
    console.error("[lm-observability] invalid Wazuh port/protocol");
    return false;
  }
  const payload = formatAlert(event);
  return new Promise<boolean>((resolve) => {
    const udp = protocol.startsWith("udp") ? createSocket("udp4") : undefined;
    const tcp = udp ? undefined : createConnection({ host, port });
    let finished = false;
    const finish = (ok: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (udp) { try { udp.close(); } catch { /* Socket not bound yet. */ } }
      tcp?.destroy();
      if (!ok) console.error("[lm-observability] Wazuh delivery failed");
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 3000);
    if (udp) {
      udp.on("error", () => finish(false));
      udp.send(payload, port, host, (err) => finish(!err));
    } else if (tcp) {
      tcp.on("error", () => finish(false));
      tcp.on("connect", () => tcp.end(payload + "\n", () => finish(true)));
    }
  });
}
