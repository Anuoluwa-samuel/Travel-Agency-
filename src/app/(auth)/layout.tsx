import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <aside className="surface-dark relative hidden flex-col justify-between overflow-hidden bg-navy-900 p-12 text-navy-100 lg:flex">
        <Logo tone="light" />
        <div className="flex max-w-md flex-col gap-4">
          <span className="gold-rule" aria-hidden="true" />
          <p className="font-heading text-3xl leading-snug text-cloud-50">
            Your bookings, documents and travel plans in one secure place.
          </p>
        </div>
        <p className="text-sm">Two-factor authentication is available for every account.</p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-10 sm:px-10">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  );
}
