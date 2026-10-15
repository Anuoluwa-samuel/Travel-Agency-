import { describe, expect, it } from "vitest";
import { parseBody, parseInline, readingMinutes, safeHref } from "@/lib/content/parse";

describe("parseBody", () => {
  it("parses headings, paragraphs and lists", () => {
    const blocks = parseBody(
      "## Packing\nBring light layers\nand a hat.\n\n- Passport\n- Sunscreen\n\n1. First\n2. Second",
    );
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "ol"]);
    expect(blocks[0]).toMatchObject({ text: "Packing", id: "packing" });
    expect(blocks[1]).toMatchObject({ inline: [{ type: "text", value: "Bring light layers and a hat." }] });
    expect(blocks[2]).toMatchObject({ items: [[{ value: "Passport" }], [{ value: "Sunscreen" }]] });
  });

  it("gives duplicate headings unique ids", () => {
    const ids = parseBody("## Tips\n\n## Tips").flatMap((b) => ("id" in b ? [b.id] : []));
    expect(ids).toEqual(["tips", "tips-2"]);
  });

  it("never produces raw HTML", () => {
    const blocks = parseBody("<script>alert(1)</script>\n\n## <img src=x onerror=alert(1)>");
    expect(blocks[0]).toEqual({ type: "p", inline: [{ type: "text", value: "<script>alert(1)</script>" }] });
    expect(blocks[1]).toMatchObject({ type: "h2", text: "<img src=x onerror=alert(1)>" });
  });
});

describe("links", () => {
  it("allows site paths and http(s) only", () => {
    expect(safeHref("/consultations")).toBe("/consultations");
    expect(safeHref("https://www.gov.uk/foreign-travel-advice")).toBe("https://www.gov.uk/foreign-travel-advice");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
  });

  it("renders unsafe links as plain text", () => {
    expect(parseInline("[click](javascript:alert(1))")).toEqual([{ type: "text", value: "click" }]);
    expect(parseInline("[wiki](https://en.wikipedia.org/wiki/Zanzibar_(city))")).toEqual([
      { type: "link", text: "wiki", href: "https://en.wikipedia.org/wiki/Zanzibar_(city)" },
    ]);
    expect(parseInline("See **this** [page](/guides).")).toEqual([
      { type: "text", value: "See " },
      { type: "strong", value: "this" },
      { type: "text", value: " " },
      { type: "link", text: "page", href: "/guides" },
      { type: "text", value: "." },
    ]);
  });
});

describe("readingMinutes", () => {
  it("rounds at 220 wpm with a one-minute floor", () => {
    expect(readingMinutes("word ".repeat(50))).toBe(1);
    expect(readingMinutes("word ".repeat(660))).toBe(3);
  });
});
