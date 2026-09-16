import { createHash } from "node:crypto";

/**
 * Normalise a pasted URL so the same post pasted twice dedupes: lowercase host,
 * drop query string and fragment, drop trailing slash, drop "www.".
 */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

/** External id for manually pasted items: the normalised URL, or a hash of the text. */
export function manualExternalId(url: string | null, title: string | null, body: string | null): string {
  const n = url ? normalizeUrl(url) : null;
  if (n) return `url:${n}`;
  const h = createHash("sha1")
    .update(`${(title ?? "").trim().toLowerCase()}\n${(body ?? "").trim().toLowerCase()}`)
    .digest("hex");
  return `text:${h}`;
}

/**
 * Reddit id from a permalink. A post link
 *   https://www.reddit.com/r/diabetes/comments/abc123/title/                → "abc123"
 *   https://redd.it/abc123                                                   → "abc123"
 * A comment link, old style (post id, slug, comment id) or the current style
 * with a literal "comment" segment:
 *   https://www.reddit.com/r/diabetes/comments/abc123/title/xyz789/         → "abc123:xyz789"
 *   https://www.reddit.com/r/diabetes/comments/abc123/title/comment/xyz789/ → "abc123:xyz789"
 * so two comments on one post never collapse into one item.
 */
export function redditIdFromUrl(url: string): string | null {
  const short = url.match(/redd\.it\/([a-z0-9]+)/i);
  if (short) return short[1].toLowerCase();
  const m = url.match(/\/comments\/([a-z0-9]+)(?:\/[^/?#]*(?:\/comment)?\/([a-z0-9]+))?/i);
  if (!m) return null;
  const post = m[1].toLowerCase();
  const comment = m[2]?.toLowerCase();
  return comment ? `${post}:${comment}` : post;
}

export function subredditFromUrl(url: string): string | null {
  const m = url.match(/reddit\.com\/r\/([A-Za-z0-9_]+)/i);
  return m ? m[1] : null;
}
