# Configurable Assumptions Register

**Status:** Phase 1 · 2026-10-15

Every default here is a reversible choice we made because the information wasn't available yet. Each one is stored in `settings` (or in a seed) and can be changed without touching code. When the owner confirms a value, update the "Confirmed" column and record it in `MEMORY.md`.

| Key | Default | Where it lives | Confirmed |
|-----|---------|----------------|:-:|
| `brand.name` | "Voyagr" (placeholder) | settings | – |
| `brand.logo` | Text wordmark + gold compass glyph | settings / media | – |
| `brand.colors` | Navy `#0B2545`, Gold `#D6A85C`, Cloud `#F7F8FA` | design tokens | ✓ |
| `contact.email/phone/whatsapp/address` | Empty → hidden in UI until set | settings | – |
| `legal.entity_name`, `legal.registration`, licences | Empty → not displayed | settings | – |
| `currency.base` | NGN | settings | – |
| `currency.display` | NGN, USD, GBP, EUR | currencies table | – |
| `currency.fx_markup_bp` | 0 (no markup on indicative conversion) | settings | – |
| `timezone.business` | Africa/Lagos | settings | – |
| `locale.default` | en-NG (English) | settings | – |
| `tax.vat_bp` | 750 (7.5% Nigerian VAT) applied to agency service fees only, **pending accountant confirmation** | fees table | – |
| `booking.deposit_bp` | 3000 (30%) per package, overridable | payment_plans | – |
| `booking.balance_due_days` | 45 days before departure | payment_plans | – |
| `booking.hold_minutes` | 30 min inventory hold for instant bookings | settings | – |
| `quote.validity_hours` | 24h for packages, provider TTL for flights/hotels | settings | – |
| `cancellation.default_tiers` | >60 days: deposit forfeited · 30–60: 50% · <30: 100% (placeholder wording, needs owner/legal review) | policies | – |
| `guest_lookup.code_ttl_min` | 10 | settings | – |
| `ai.daily_limit_per_user` | 20 proposals/day (anon: 3) | settings | – |
| `documents.max_size_mb` | 10 | settings | – |
| `documents.allowed_types` | PDF, JPEG, PNG, HEIC | settings | – |
| `documents.retention_days_after_close` | 90 | settings | – |
| `staff.assigned_only_scope` | false (agents see all bookings) | settings | – |
| `staff.require_2fa_roles` | super_admin, ops_manager, finance_officer, visa_officer | settings | – |
| `consultation.slot_minutes` | 30 | consultation_services | – |
| `notifications.whatsapp_enabled` | false | settings | – |
| Payment provider | Paystack | env | – |
| Hosting | Vercel (web) + Neon (Postgres) + Railway/Fly (worker) | docs | – |
