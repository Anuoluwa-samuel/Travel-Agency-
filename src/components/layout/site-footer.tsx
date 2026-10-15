import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { brand } from "@/config/brand";
import { footerNav, liveOnly } from "@/config/navigation";

export function SiteFooter() {
  const groups = liveOnly(footerNav);
  const { contact, legal } = brand;
  const hasContact = Boolean(contact.email || contact.phone || contact.whatsapp || contact.address);

  return (
    <footer className="surface-dark mt-auto bg-navy-900 text-navy-100">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-4">
          <Logo tone="light" />
          <p className="max-w-xs text-sm leading-relaxed">{brand.tagline}</p>
          {/* Contact details render only once configured; nothing is invented. */}
          {hasContact && (
            <address className="flex flex-col gap-1 text-sm not-italic">
              {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
              {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>}
              {contact.address && <span>{contact.address}</span>}
            </address>
          )}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="eyebrow mb-3 font-sans">{group.label}</h2>
              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="inline-flex min-h-11 items-center text-sm hover:text-cloud-50">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-navy-800">
        <div className="container-page flex flex-col gap-2 py-6 text-xs sm:flex-row sm:justify-between">
          <p>
            © <CopyrightYear /> {legal.entityName || brand.name}
            {legal.registrationNumber && ` · RC ${legal.registrationNumber}`}
          </p>
          <p>Prices and availability are confirmed at booking.</p>
        </div>
      </div>
    </footer>
  );
}

/** Build-time year is fine for a footer; it refreshes on every deploy. */
async function CopyrightYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}
