// True when a database write failed because of a unique rule (Prisma code
// P2002). Pure (no database import) so it can be unit tested. `field` lets a
// caller ask about one specific column, e.g. "slug" or "email".
export function isUniqueViolation(e: unknown, field?: string): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: unknown; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  if (!field) return true;
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes(field));
  if (typeof target === "string") return target.includes(field);
  return false;
}
