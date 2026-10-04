// Local test outbox: writes an email as a standard .eml file (text + HTML
// parts, UTF-8) under DATA_DIR/outbox so it can be opened in a mail app.
// File names hold only a timestamp and a generated id — never an address.
// Nothing here is reachable over the web (/api/images serves only images).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/lib/storage";

export type OutboxMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const b64 = (s: string) =>
  (Buffer.from(s, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");

/** Strip anything that could break a header line. */
const headerSafe = (s: string) => s.replace(/[\r\n]+/g, " ");

export function buildEml(message: OutboxMessage, boundary: string): string {
  const lines = [
    `From: Outbox <outbox@localhost>`,
    `To: ${headerSafe(message.to)}`,
    `Subject: =?UTF-8?B?${Buffer.from(headerSafe(message.subject), "utf8").toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(message.text),
  ];
  if (message.html) {
    lines.push(
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      b64(message.html),
    );
  }
  lines.push(`--${boundary}--`, ``);
  return lines.join("\r\n");
}

/** `name` is a generated id (e.g. the saved-search id); sanitised anyway. */
export async function writeOutboxFile(
  message: OutboxMessage,
  name: string,
): Promise<string> {
  const dir = path.join(dataDir(), "outbox");
  await mkdir(dir, { recursive: true });
  const safe = name.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "mail";
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  const rand = Math.random().toString(36).slice(2, 8);
  const file = path.join(dir, `${stamp}-${safe}-${rand}.eml`);
  await writeFile(file, buildEml(message, `=_opip_${rand}${Date.now()}`), "utf8");
  return file;
}
