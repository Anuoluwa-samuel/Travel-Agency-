import { CalendarX2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingForm } from "@/components/consultations/booking-form";
import { LocalTimeHint } from "@/components/consultations/local-time";
import { EmptyState } from "@/components/feedback/states";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteUrl } from "@/config/site";
import { formatInZone } from "@/lib/zoned-time";
import { BUSINESS_TZ, getAvailability, listConsultationServices } from "@/server/services/consultations/service";
import { groupByDate } from "@/server/services/consultations/slots";
import { cn } from "cn";

export async function generateStaticParams() {
  const services = await listConsultationServices();
  return services.length ? services.map((s) => ({ slug: s.slug })) : [{ slug: "__none" }];
}

export async function generateMetadata({ params }: PageProps<"/consultations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = (await listConsultationServices()).find((x) => x.slug === slug);
  return s
    ? { title: `Book: ${s.name}`, description: s.description, alternates: { canonical: `/consultations/${slug}` } }
    : { title: "Consultation not found", robots: { index: false } };
}

export default function BookConsultationPage(props: PageProps<"/consultations/[slug]">) {
  return (
    <div className="container-page flex flex-col gap-8 py-10 md:py-14">
      <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
        <Booking params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const day = (date: string) =>
  formatInZone(`${date}T12:00:00Z`, "UTC", { weekday: "short", day: "numeric", month: "short" });
const time = (d: Date) => formatInZone(d, BUSINESS_TZ, { hour: "2-digit", minute: "2-digit" });

async function Booking({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  // Live availability depends on the current time and other bookings: request time only.
  await connection();
  const availability = await getAvailability(slug);
  if (!availability) notFound();
  const { service, slots } = availability;

  const byDate = groupByDate(slots, BUSINESS_TZ);
  const dates = [...byDate.keys()];
  const requestedDate = typeof sp.date === "string" && byDate.has(sp.date) ? sp.date : dates[0];
  const daySlots = requestedDate ? (byDate.get(requestedDate) ?? []) : [];
  const requestedStart = typeof sp.start === "string" ? sp.start : null;
  const chosen = requestedStart ? slots.find((s) => s.startsAt.toISOString() === requestedStart) : undefined;

  return (
    <>
      <div className="flex max-w-2xl flex-col gap-4">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Consultations", href: "/consultations" },
            { label: service.name, href: `/consultations/${service.slug}` },
          ]}
        />
        <h1 className="text-3xl md:text-4xl">{service.name}</h1>
        <p className="text-muted-foreground">{service.durationMinutes} minutes. Times are shown in Lagos time (WAT).</p>
      </div>

      {slots.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="No times available in the next three weeks"
          description="Send us a message and we'll find a time that works."
          action={
            <Button asChild>
              <Link href="/contact">Contact us</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <section aria-labelledby="pick" className="flex flex-col gap-6">
            <h2 id="pick" className="text-xl">
              1. Pick a day and time
            </h2>
            <nav aria-label="Available days" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              {dates.map((d) => (
                <Link
                  key={d}
                  href={`/consultations/${service.slug}?date=${d}`}
                  aria-current={d === requestedDate ? "date" : undefined}
                  scroll={false}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center rounded-md border px-4 text-sm whitespace-nowrap",
                    d === requestedDate
                      ? "border-navy-900 bg-navy-900 text-cloud-50"
                      : "bg-white hover:border-navy-700",
                  )}
                >
                  {day(d)}
                </Link>
              ))}
            </nav>
            <ul
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              aria-label={`Times on ${requestedDate ? day(requestedDate) : ""}`}
            >
              {daySlots.map((s) => {
                const iso = s.startsAt.toISOString();
                const active = chosen && iso === chosen.startsAt.toISOString();
                return (
                  <li key={iso}>
                    <Link
                      href={`/consultations/${service.slug}?date=${requestedDate}&start=${encodeURIComponent(iso)}#details`}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "tabular flex min-h-11 flex-col items-center justify-center rounded-md border px-3 py-2 text-sm",
                        active ? "border-navy-900 bg-navy-900 text-cloud-50" : "bg-white hover:border-navy-700",
                      )}
                    >
                      {time(s.startsAt)}
                      {!active && <LocalTimeHint iso={iso} businessTz={BUSINESS_TZ} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section id="details" aria-labelledby="details-h" className="flex scroll-mt-24 flex-col gap-6">
            <h2 id="details-h" className="text-xl">
              2. Your details
            </h2>
            {chosen ? (
              <>
                <p className="rounded-md bg-cloud-100 px-4 py-3 text-sm">
                  {formatInZone(chosen.startsAt, BUSINESS_TZ, { weekday: "long", day: "numeric", month: "long" })} at{" "}
                  <strong>{time(chosen.startsAt)} WAT</strong>
                  <LocalTimeHint iso={chosen.startsAt.toISOString()} businessTz={BUSINESS_TZ} />
                </p>
                <BookingForm
                  key={chosen.startsAt.toISOString()}
                  serviceSlug={service.slug}
                  startsAt={chosen.startsAt.toISOString()}
                  formats={service.formats}
                  businessTz={BUSINESS_TZ}
                />
              </>
            ) : (
              <p className="text-muted-foreground">
                {requestedStart
                  ? "That time is no longer available. Please choose another."
                  : "Choose a time to continue."}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
