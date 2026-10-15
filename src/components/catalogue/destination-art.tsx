import { cn } from "cn";
import { CompassMark } from "@/components/brand/logo";

/**
 * Typographic stand-in until licensed photography is uploaded through the media library.
 * Deliberately not a stock photo: nothing here pretends to be a real picture of the place.
 */
export function DestinationArt({
  name,
  label,
  className,
  size = "md",
}: {
  name: string;
  label?: string | null;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "surface-dark relative isolate flex overflow-hidden bg-navy-900",
        size === "md" ? "aspect-[4/3] rounded-lg p-5" : "min-h-72 p-8 md:min-h-96 md:p-12",
        className,
      )}
    >
      <CompassMark className="absolute -right-10 -bottom-10 -z-10 size-56 text-navy-700 opacity-[0.12]" />
      <span
        className={cn(
          "absolute -top-4 right-4 -z-10 font-heading leading-none text-navy-800 select-none",
          size === "md" ? "text-[9rem]" : "text-[16rem]",
        )}
      >
        {name.charAt(0)}
      </span>
      <div className="mt-auto flex flex-col gap-1">
        {label && <span className="eyebrow">{label}</span>}
        <span className={cn("font-heading text-cloud-50", size === "md" ? "text-2xl" : "text-5xl md:text-7xl")}>
          {name}
        </span>
      </div>
    </div>
  );
}
