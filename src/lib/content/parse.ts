/**
 * Parser for the article body format. Deliberately tiny and HTML-free so content can never
 * inject markup or scripts (RULES.md §4):
 *
 *   ## Heading            ### Subheading
 *   - list item           1. numbered item
 *   blank line = paragraph break
 *   [link text](https://… or /path)   **bold**
 */

export type Inline =
  { type: "text"; value: string } | { type: "strong"; value: string } | { type: "link"; text: string; href: string };

export type Block =
  | { type: "h2" | "h3"; text: string; id: string }
  | { type: "p"; inline: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/** Only same-site paths and http(s) URLs are allowed as link targets. */
export function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  try {
    const u = new URL(h);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  // Link targets may contain one level of parentheses, e.g. Wikipedia-style URLs.
  const re = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      const href = safeHref(m[2]);
      out.push(href ? { type: "link", text: m[1], href } : { type: "text", value: m[1] });
    } else {
      out.push({ type: "strong", value: m[3] });
    }
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  const usedIds = new Set<string>();
  const uniqueId = (text: string) => {
    let id = slugify(text) || "section";
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(text)}-${n}`;
    usedIds.add(id);
    return id;
  };

  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: Inline[][] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
    para = [];
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of body.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ type: h[1].length === 2 ? "h2" : "h3", text: h[2], id: uniqueId(h[2]) });
      continue;
    }
    const li = /^(-|\d+\.)\s+(.+)$/.exec(line);
    if (li) {
      const type = li[1] === "-" ? "ul" : "ol";
      if (para.length) {
        blocks.push({ type: "p", inline: parseInline(para.join(" ")) });
        para = [];
      }
      if (!list || list.type !== type) {
        if (list) blocks.push(list);
        list = { type, items: [] };
      }
      list.items.push(parseInline(li[2]));
      continue;
    }
    if (list) {
      blocks.push(list);
      list = null;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** Rough reading time at 220 words per minute, minimum one minute. */
export function readingMinutes(body: string): number {
  return Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 220));
}
