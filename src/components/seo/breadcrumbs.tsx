import Link from "next/link";
import { JsonLd } from "./json-ld";

export interface Crumb {
  label: string;
  href: string;
}

export function Breadcrumbs({ items, baseUrl }: { items: Crumb[]; baseUrl: string }) {
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {items.map((c, i) => (
            <li key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {i === items.length - 1 ? (
                <span aria-current="page" className="text-navy-900">
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="underline-offset-4 hover:text-navy-900 hover:underline">
                  {c.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.label,
            item: new URL(c.href, baseUrl).toString(),
          })),
        }}
      />
    </>
  );
}
