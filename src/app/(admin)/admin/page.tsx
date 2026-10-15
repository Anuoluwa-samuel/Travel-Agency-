import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS, ROLES, type RoleKey } from "@/server/auth/permissions";
import { requireStaff } from "@/server/auth/session";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const ctx = await requireStaff();
  const roleNames = ctx.roles.map((r) => ROLES[r as RoleKey]?.name ?? r);

  return (
    <div className="flex max-w-5xl flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">Operations</p>
        <h1 className="text-3xl">Good to see you, {ctx.user.name.split(" ")[0]}</h1>
        <div className="flex flex-wrap gap-2">
          {roleNames.map((r) => (
            <Badge key={r} variant="secondary">
              {r}
            </Badge>
          ))}
        </div>
      </div>

      <EmptyState
        icon={ClipboardList}
        title="Nothing needs your attention"
        description="New enquiries, bookings awaiting confirmation and payments due will be listed here."
      />

      <section aria-labelledby="perm-heading" className="flex flex-col gap-3">
        <h2 id="perm-heading" className="text-xl">
          What your role can do
        </h2>
        <ul className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {[...ctx.permissions].sort().map((p) => (
            <li key={p} className="flex items-baseline gap-2 border-b py-2">
              <span className="text-navy-900">{PERMISSIONS[p]}</span>
              <code className="ml-auto text-xs text-muted-foreground">{p}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
