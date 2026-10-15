import { ArrowRight, Clock, MapPin, Phone, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { siteUrl } from "@/config/site";
import { formatMoney, isCurrencyCode, money } from "@/lib/money";
import { FORMAT_LABELS } from "@/lib/validation/consultation";
import { listConsultationServices } from "@/server/services/consultations/service";

export const metadata: Metadata = {
  title: "Book a consultation",
  description: "Book a call or meeting with an ORBIS travel consultant or visa officer at a time that suits you.",
  alternates: { canonical: "/consultations" },
};

const formatIcon = { video: Video, phone: Phone, in_person: MapPin } as const;

export default async function ConsultationsPage() {
  const services = await listConsultationServices();
  return (
    <div className="container-page flex flex-col gap-10 py-10 md:py-14">
      <div className="flex max-w-2xl flex-col gap-4">
        <Breadcrumbs
          baseUrl={siteUrl}
          items={[
            { label: "Home", href: "/" },
            { label: "Consultations", href: "/consultations" },
          ]}
        />
        <h1 className="text-4xl md:text-5xl">Talk to a specialist</h1>
        <p className="text-lg text-muted-foreground">
          Pick a time that works for you. You’ll get a confirmation with your reference straight away.
        </p>
      </div>
      {services.length === 0 ? (
        <p className="text-muted-foreground">
          Online booking isn’t open right now.{" "}
          <Link href="/contact" className="underline underline-offset-4">
            Send us a message
          </Link>{" "}
          and we’ll arrange a time.
        </p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => {
            const code = s.currency?.trim() ?? "";
            const price =
              s.priceMinor !== null && isCurrencyCode(code) ? formatMoney(money(s.priceMinor, code)) : "Free";
            return (
              <li key={s.slug} className="flex flex-col justify-between gap-6 rounded-lg border bg-white p-6">
                <div className="flex flex-col gap-3">
                  <h2 className="text-xl">{s.name}</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-800">
                    <li className="flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden="true" /> {s.durationMinutes} minutes
                    </li>
                    {s.formats.map((f) => {
                      const Icon = formatIcon[f];
                      return (
                        <li key={f} className="flex items-center gap-1.5">
                          <Icon className="size-3.5" aria-hidden="true" /> {FORMAT_LABELS[f]}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-4 border-t pt-4">
                  <span className="font-medium">{price}</span>
                  <Button asChild>
                    <Link href={`/consultations/${s.slug}`}>
                      Choose a time <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
