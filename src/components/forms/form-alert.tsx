import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Form-level message. Errors use role="alert" so they are announced immediately. */
export function FormAlert({
  tone,
  title,
  children,
}: {
  tone: "error" | "success";
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <Alert
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "border-status-danger/30 bg-red-50 text-status-danger"
          : "border-status-confirmed/30 bg-emerald-50 text-status-confirmed"
      }
    >
      <Icon aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {children && <AlertDescription className="text-ink">{children}</AlertDescription>}
    </Alert>
  );
}
