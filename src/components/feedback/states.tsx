import { AlertTriangle, Compass } from "lucide-react";
import { cn } from "cn";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Compass,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-8 text-gold-600" aria-hidden="true" />
      <h3 className="text-lg">{title}</h3>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again in a moment.",
  action,
  reference,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  /** Request/error id the customer can quote to support. */
  reference?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-status-danger/30 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-8 text-status-danger" aria-hidden="true" />
      <h3 className="text-lg">{title}</h3>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {reference && (
        <p className="text-xs text-muted-foreground">
          Reference: <code className="font-mono">{reference}</code>
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
