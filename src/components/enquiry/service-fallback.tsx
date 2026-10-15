import { Info } from "lucide-react";
import { EnquiryForm } from "@/components/enquiry/enquiry-form";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { siteUrl } from "@/config/site";
import type { EnquiryCategory } from "@/lib/validation/enquiry";

/**
 * Shown while no live supplier search is connected for a service (docs/integrations.md).
 * States plainly that results are not live, then offers the consultant-led route instead of
 * showing anything that could be mistaken for real inventory.
 */
export function ServiceFallback({
  title,
  intro,
  category,
  path,
  points,
}: {
  title: string;
  intro: string;
  category: EnquiryCategory;
  path: string;
  points: string[];
}) {
  return (
    <div className="container-page grid gap-12 py-10 md:py-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)] xl:gap-20">
      <div className="flex flex-col gap-6">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: title, href: path },
          ]}
        />
        <h1 className="text-4xl md:text-5xl">{title}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">{intro}</p>
        <div className="flex gap-3 rounded-lg border border-navy-300 bg-navy-100/50 p-4 text-sm" role="note">
          <Info className="mt-0.5 size-4 shrink-0 text-navy-700" aria-hidden="true" />
          <p>
            Instant online search isn’t available yet. A consultant searches live fares and rates for you and sends
            options with real prices, usually within one working day.
          </p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {points.map((p) => (
            <li key={p} className="flex gap-2 before:text-gold-600 before:content-['—']">
              {p}
            </li>
          ))}
        </ul>
      </div>
      <EnquiryForm context={{ category }} sourcePage={path} />
    </div>
  );
}
