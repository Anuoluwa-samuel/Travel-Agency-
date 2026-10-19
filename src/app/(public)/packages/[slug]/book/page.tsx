import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { siteUrl } from "@/config/site";
import { getPackage, getPublishedSlugs, staticSlugParams } from "@/server/services/catalogue/queries";

export async function generateStaticParams() {
  const { packages } = await getPublishedSlugs();
  return staticSlugParams(packages);
}

export const metadata: Metadata = { title: "Book", robots: { index: false, follow: false } };

export default function BookPage(props: PageProps<"/packages/[slug]/book">) {
  return (
    <div className="container-page flex max-w-4xl flex-col gap-8 py-10 md:py-14">
      <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
        <Book params={props.params} />
      </Suspense>
    </div>
  );
}

async function Book({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPackage(slug);
  if (!p) notFound();
  if (p.bookingMode === "enquiry") redirect(`/contact?category=package&package=${p.slug}`);

  return (
    <>
      <div className="flex flex-col gap-3">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Packages", href: "/packages" },
            { label: p.title, href: `/packages/${p.slug}` },
            { label: "Book", href: `/packages/${p.slug}/book` },
          ]}
        />
        <h1 className="text-3xl md:text-4xl">
          {p.bookingMode === "instant" ? "Book" : "Request to book"}: {p.title}
        </h1>
        <p className="text-muted-foreground">
          {p.durationDays} days · {p.destinationName}, {p.countryName}
        </p>
      </div>
      <BookingWizard
        pkg={{
          slug: p.slug,
          title: p.title,
          bookingMode: p.bookingMode,
          maxPax: p.maxPax,
          rooms: p.rooms,
          addons: p.addons.map((a) => ({ id: a.id, name: a.name })),
          departures: p.departures.map((d) => ({
            id: d.id,
            startDate: d.startDate,
            endDate: d.endDate,
            availability: d.availability,
          })),
          cancellationTitle: p.cancellationPolicy?.title ?? null,
          cancellationBody: p.cancellationPolicy?.body ?? null,
        }}
      />
    </>
  );
}
