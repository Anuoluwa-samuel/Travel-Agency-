import Link from "next/link";
import { type Block, type Inline, parseBody } from "@/lib/content/parse";

/** Renders parsed article blocks as React elements: no dangerouslySetInnerHTML anywhere. */
export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="flex max-w-prose flex-col gap-5 text-lg leading-relaxed">
      {parseBody(body).map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

export function tableOfContents(body: string): { id: string; text: string }[] {
  return parseBody(body).flatMap((b) => (b.type === "h2" ? [{ id: b.id, text: b.text }] : []));
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={block.id} className="mt-6 scroll-mt-24 text-2xl">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 id={block.id} className="mt-2 scroll-mt-24 text-xl">
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p>
          <Inlines items={block.inline} />
        </p>
      );
    case "ul":
    case "ol": {
      const List = block.type;
      return (
        <List
          className={
            List === "ul"
              ? "flex list-disc flex-col gap-2 pl-6 marker:text-gold-600"
              : "flex list-decimal flex-col gap-2 pl-6"
          }
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines items={item} />
            </li>
          ))}
        </List>
      );
    }
  }
}

function Inlines({ items }: { items: Inline[] }) {
  return items.map((it, i) => {
    if (it.type === "strong") return <strong key={i}>{it.value}</strong>;
    if (it.type === "link") {
      return it.href.startsWith("/") ? (
        <Link key={i} href={it.href} className="text-navy-700 underline underline-offset-4">
          {it.text}
        </Link>
      ) : (
        <a
          key={i}
          href={it.href}
          rel="noopener noreferrer"
          target="_blank"
          className="text-navy-700 underline underline-offset-4"
        >
          {it.text}
        </a>
      );
    }
    return <span key={i}>{it.value}</span>;
  });
}
