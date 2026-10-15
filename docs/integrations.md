# Integrations & Credentials

**Status:** Phase 1 · 2026-10-15

Every external service sits behind a port interface in `src/server/integrations/<port>/`. Each adapter declares `capabilities`. If a provider has no credentials, the `unconfigured` adapter is selected and the UI shows an honest fallback.

| Port | Adapter (v1) | Purpose | Required env | Launch-critical | Fallback when missing |
|------|--------------|---------|--------------|:-:|------------------------|
| Database | PostgreSQL | Primary store | `DATABASE_URL` | ✓ | App refuses to boot |
| Auth | Better Auth | Sessions, verification, 2FA | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | ✓ | Boot fails |
| Payments | **Paystack** | Card/bank/transfer payments, refunds | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_WEBHOOK_SECRET`* | ✓ | "Pay online unavailable — we'll send a payment link" + staff manual payment recording |
| Email | **Resend** | Transactional email | `RESEND_API_KEY`, `EMAIL_FROM` | ✓ | Console adapter in dev only; prod boot warns + notifications marked failed |
| Storage (private) | S3 / Cloudflare R2 | Travel documents | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PRIVATE_BUCKET` | ✓ for visa docs | Local disk in dev; uploads disabled in prod with message |
| Storage (public) | S3 / R2 + CDN | Media | `S3_PUBLIC_BUCKET`, `PUBLIC_MEDIA_BASE_URL` | ✓ | Local `/public/uploads` in dev |
| Encryption | App-level AES-256-GCM | Passport/DOB fields | `DATA_ENCRYPTION_KEY` (32 bytes base64) | ✓ | Boot fails |
| AI | **Anthropic Claude** | Trip planner | `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-sonnet-5-5`) | – | "Planner temporarily unavailable — talk to a consultant" |
| FX rates | Configurable (e.g. Open Exchange Rates) | Indicative display conversion | `FX_PROVIDER`, `FX_API_KEY` | – | Base currency only; staff can set manual rates |
| Flights | Mock (simulated) → **Duffel** planned | Search, offers, orders | `DUFFEL_ACCESS_TOKEN` | – | Flight enquiry form |
| Hotels | Mock (simulated) → Hotelbeds / Amadeus planned | Availability, booking | provider-specific | – | Hotel enquiry form |
| WhatsApp | Meta WhatsApp Cloud API | Notifications, support | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` | – | `wa.me` click-to-chat link only (never reported as "delivered") |
| SMS | Termii / Twilio (optional) | OTP fallback, reminders | provider keys | – | Email only |
| Weather | Open-Meteo or similar | Companion forecasts | (none / key) | – | "Weather unavailable" + source link |
| Flight status | Provider TBD (e.g. AeroDataBox) | Companion | key | – | Link to airline status page |
| Travel advisories | Curated links to official sources (FCDO, US State Dept, NG MFA) | Companion / visa | — | – | Static official links |
| Malware scan | ClamAV sidecar or provider | Upload scanning | `CLAMAV_URL` | – | `scan_status = skipped`, file held for staff review before release |
| Error reporting | Sentry | Errors | `SENTRY_DSN` | – | Logs only |
| Analytics | Plausible / GA4 with consent | Funnels | `NEXT_PUBLIC_ANALYTICS_*` | – | Disabled |
| Captcha (abuse) | Cloudflare Turnstile | Forms | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | – | Rate limit + honeypot only |

\* Paystack signs webhooks with the secret key (HMAC SHA-512 of the raw body in `x-paystack-signature`). Verify this against current Paystack docs during Phase 4.

## Adapter capability example

```ts
export interface FlightProvider {
  readonly key: string;
  readonly simulated: boolean;          // true → UI shows "Simulated data"
  readonly capabilities: {
    search: boolean; offerDetails: boolean; revalidate: boolean;
    createOrder: boolean; ticket: boolean; status: boolean; cancel: boolean;
  };
  search?(q: FlightSearch): Promise<FlightOffer[]>;
  revalidate?(offerId: string): Promise<FlightOffer>;
  // …only methods the provider genuinely supports
}
```

## Credentials checklist for launch (owner to supply)

- [ ] Domain + DNS access (email SPF/DKIM/DMARC for Resend)
- [ ] Paystack live + test keys, settlement account, enabled currencies
- [ ] Resend account + verified sending domain
- [ ] S3/R2 buckets (private + public) + access keys
- [ ] Managed PostgreSQL (Neon / Supabase / RDS) + backups enabled
- [ ] Anthropic API key + spend limit
- [ ] (Optional) Duffel / hotel supplier contracts + API credentials
- [ ] (Optional) WhatsApp Business account, verified number, approved templates
- [ ] (Optional) Sentry project, analytics account, Turnstile site
- [ ] Agency legal details, logo, policy texts reviewed by a lawyer
