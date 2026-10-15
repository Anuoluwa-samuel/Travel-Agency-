import { CheckCircle2, CircleDashed, Clock3, FlaskConical, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "cn";

/**
 * Status tone, not status value: domain code maps its own statuses to a tone so the visual
 * language (DESIGN.md §1, status tokens) stays consistent. Colour is always paired with an
 * icon and a text label.
 */
export type StatusTone = "confirmed" | "pending" | "proposed" | "danger" | "info" | "simulated";

const tones: Record<StatusTone, { className: string; icon: LucideIcon }> = {
  confirmed: {
    className: "bg-status-confirmed text-white border-transparent",
    icon: CheckCircle2,
  },
  pending: {
    className: "border-status-pending/50 bg-gold-50 text-status-pending",
    icon: Clock3,
  },
  proposed: {
    className: "border-dashed border-navy-500 bg-white text-navy-700",
    icon: CircleDashed,
  },
  danger: {
    className: "border-status-danger/30 bg-red-50 text-status-danger",
    icon: XCircle,
  },
  info: {
    className: "border-transparent bg-navy-100 text-navy-700",
    icon: Info,
  },
  simulated: {
    className:
      "border-navy-300 text-navy-700 bg-[repeating-linear-gradient(135deg,var(--color-navy-100)_0_6px,var(--color-cloud-50)_6px_12px)]",
    icon: FlaskConical,
  },
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon: Icon } = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

/** Mandatory marker for any data produced by a mock adapter (RULES.md §1.4). */
export function SimulatedDataBadge({ className }: { className?: string }) {
  return (
    <StatusBadge tone="simulated" className={className}>
      Simulated data
    </StatusBadge>
  );
}
