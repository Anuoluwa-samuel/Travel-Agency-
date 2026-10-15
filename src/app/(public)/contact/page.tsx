import { Clock, FileCheck2, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EnquiryForm, type EnquiryContext } from "@/components/enquiry/enquiry-form";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { brand } from "@/config/brand";
import { siteUrl } from "@/config/site";
import { ENQUIRY_CATEGORIES, type EnquiryCategory } from "@/lib/validation/enquiry";
import { getDestination, getPackage } from "@/server/services/catalogue/queries";

export const metadata: Metadata = {
  title: "Plan your trip with us",
  description:
    "Tell us where and when you'd like to travel. A consultant will reply with options and confirmed prices.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage({ searchParams }: PageProps<"/contact">) {
  return (
    <div className="container-page grid gap-12 py-10 md:py-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,640px)] xl:gap-20">
      <div className="flex flex-col gap-8">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Contact", href: "/contact" },
          ]}
        />
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl md:text-5xl">Let’s plan your trip</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Share as much or as little as you know. A consultant takes it from there.
          </p>
        </div>
        <ol className="flex flex-col gap-6">
          {[
            {
              icon: MessageSquareText,
              title: "You tell us what you want",
              body: "Dates, budget, who's travelling and what you enjoy.",
            },
            {
              icon: Clock,
              title: "We reply with options",
              body: "Usually within one working day, with prices checked against current availability.",
            },
            { icon: FileCheck2, title: "You decide", body: "Nothing is booked or charged until you approve a quote." },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-gold-500">
                {i + 1}
              </span>
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <Icon className="size-4 text-gold-700" aria-hidden="true" /> {title}
                </p>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        {(brand.contact.email || brand.contact.phone || brand.contact.whatsapp) && (
          <div className="flex flex-col gap-1 border-t pt-6 text-sm">
            <p className="font-medium">Prefer to talk?</p>
            {brand.contact.phone && <a href={`tel:${brand.contact.phone.replace(/\s/g, "")}`}>{brand.contact.phone}</a>}
            {brand.contact.whatsapp && (
              <a
                href={`https://wa.me/${brand.contact.whatsapp.replace(/\D/g, "")}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp {brand.contact.whatsapp}
              </a>
            )}
            {brand.contact.email && <a href={`mailto:${brand.contact.email}`}>{brand.contact.email}</a>}
          </div>
        )}
      </div>
      <Suspense fallback={<Skeleton className="h-[720px] w-full" />}>
        <FormWithContext searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FormWithContext({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const slugOk = (s?: string) => (s && /^[a-z0-9-]{1,120}$/.test(s) ? s : undefined);

  const categoryParam = str("category");
  const category =
    categoryParam && categoryParam in ENQUIRY_CATEGORIES ? (categoryParam as EnquiryCategory) : undefined;
  const [pkg, dest] = await Promise.all([
    slugOk(str("package")) ? getPackage(str("package")!) : null,
    slugOk(str("destination")) ? getDestination(str("destination")!) : null,
  ]);

  const context: EnquiryContext = {
    category: category ?? (pkg ? "package" : undefined),
    packageSlug: pkg?.slug,
    packageTitle: pkg?.title,
    destinationSlug: dest?.slug ?? pkg?.destinationSlug,
    destinationName: dest?.name,
  };
  const source = pkg ? `/packages/${pkg.slug}` : dest ? `/destinations/${dest.slug}` : "/contact";
  return <EnquiryForm context={context} sourcePage={source} />;
}
