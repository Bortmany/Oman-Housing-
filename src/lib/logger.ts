// ---------------------------------------------------------------------------
// Shared structured logger — one JSON line per event, no dependencies.
//
// Use this instead of scattered console.log so server logs are consistent and
// searchable. It REDACTS anything that looks like a secret (password, token,
// key, cookie, authorization, secret) at any depth so we never write a
// credential to the logs. User-facing text is handled elsewhere; this is for
// developers reading Railway logs.
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

type Context = Record<string, unknown>;

const REDACT_KEYS =
  /pass(word)?|secret|token|api[-_]?key|authorization|auth[-_]?secret|cookie|session|dsn/i;

const REDACTED = "[redacted]";

/** Deep-copy `value` with any secret-looking keys replaced by [redacted]. */
function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[circular]";
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((v) => redact(v, seen));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? REDACTED : redact(v, seen);
  }
  return out;
}

/** Turn an Error into a plain, log-safe object (message + stack, no secrets). */
function serializeError(err: unknown): Context {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

function write(level: LogLevel, message: string, context?: Context) {
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? (redact(context) as Context) : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (message: string, context?: Context) =>
    write("debug", message, context),
  info: (message: string, context?: Context) => write("info", message, context),
  warn: (message: string, context?: Context) => write("warn", message, context),
  /** `err` can be an Error or anything thrown; it is serialized safely. */
  error: (message: string, err?: unknown, context?: Context) =>
    write("error", message, { ...context, ...(err ? serializeError(err) : {}) }),
};
