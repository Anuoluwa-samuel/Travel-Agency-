import Link from "next/link";
import { cn } from "cn";
import { brand } from "@/config/brand";

/** Four-point compass glyph used as the ORBIS mark. */
export function CompassMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5 shrink-0", className)} fill="none">
      <circle cx="12" cy="12" r="10.25" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      <path d="M12 2.5 13.6 10.4 21.5 12 13.6 13.6 12 21.5 10.4 13.6 2.5 12 10.4 10.4Z" fill="var(--color-gold-500)" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  tone = "dark",
}: {
  className?: string;
  href?: string;
  /** `dark` = navy text for light surfaces, `light` = cloud text for navy surfaces. */
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-sm",
        tone === "dark" ? "text-navy-900" : "text-cloud-50",
        className,
      )}
      aria-label={`${brand.name} home`}
    >
      <CompassMark className="size-6" />
      <span className="font-heading text-[1.35rem] font-medium tracking-[0.22em]">{brand.name}</span>
    </Link>
  );
}
