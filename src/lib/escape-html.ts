// ---------------------------------------------------------------------------
// escapeHtml — turn user text into something safe to drop into an HTML string.
//
// React/JSX already escapes text for you, so you do NOT need this in normal
// components. Use it only where we build a raw HTML string by hand — HTML
// emails, or any dangerouslySetInnerHTML/innerHTML value — so user text can
// never inject markup or script (stored-XSS guard).
// ---------------------------------------------------------------------------

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape &, <, >, " and ' so `input` is safe inside HTML markup. */
export function escapeHtml(input: unknown): string {
  return String(input ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
