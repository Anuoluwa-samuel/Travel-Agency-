# Design System

**Direction:** Quiet luxury for travel. Deep navy gives trust and depth, champagne gold marks moments that matter, cloud white keeps everything calm and readable. Photography carries the emotion and the interface stays out of the way.

**Avoid:** heavy gradients, glassmorphism, card grids that all look the same, bouncy animations, decoration with no purpose, oversized empty hero sections, stock "AI website" layouts.

---

## 1. Colour

### Primary palette (required)

| Token | Hex | Role |
|-------|-----|------|
| `navy-900` **Deep Navy** | `#0B2545` | Primary brand, headings, nav, footer, primary buttons |
| `gold-500` **Champagne Gold** | `#D6A85C` | Accent, highlights, focus rings on dark, key CTAs on navy |
| `cloud-50` **Cloud White** | `#F7F8FA` | Page background, surfaces |

### Extended scales (derived)

| Navy | Hex | | Gold | Hex |
|------|-----|-|------|-----|
| navy-950 | `#071A33` | | gold-50 | `#FBF6EC` |
| navy-900 | `#0B2545` | | gold-100 | `#F4E7CD` |
| navy-800 | `#13315C` | | gold-300 | `#E6C48E` |
| navy-700 | `#1D4073` | | gold-500 | `#D6A85C` |
| navy-500 | `#3E5F8A` | | gold-600 | `#B88A3E` |
| navy-300 | `#8DA2C0` | | gold-700 | `#8C6A2E` |
| navy-100 | `#DCE3EE` | | | |

Neutrals: `white #FFFFFF`, `cloud-50 #F7F8FA`, `cloud-100 #EEF1F5`, `slate-300 #C9D0DA`, `slate-500 #6B7685`, `ink #121A26`.

### Contrast rules (WCAG 2.2 AA)

| Pair | Ratio | Use |
|------|-------|-----|
| Navy `#0B2545` on Cloud `#F7F8FA` | ≈ 14.7 : 1 | Body and headings ✓ |
| Gold `#D6A85C` on Navy `#0B2545` | ≈ 7.2 : 1 | Text/icons on dark ✓ |
| Gold `#D6A85C` on Cloud `#F7F8FA` | ≈ 2.1 : 1 | **Not for text.** Decorative lines, fills, large icons only |
| Gold-700 `#8C6A2E` on Cloud | ≈ 4.7 : 1 | Gold-tinted text on light backgrounds ✓ |
| Navy on Gold `#D6A85C` | ≈ 7.2 : 1 | Gold button labels ✓ |

### Semantic / status tokens

| Token | Meaning | Treatment |
|-------|---------|-----------|
| `status-confirmed` | Confirmed by supplier/agency | Green `#1F7A4D` + solid badge + check icon |
| `status-pending` | Awaiting action | Amber `#A15C07` + outlined badge |
| `status-proposed` | Draft/proposal, not booked | Navy-500 + dashed outline badge |
| `status-estimate` | Estimated cost | Gold-700 text + "≈" prefix + "Estimate" label |
| `status-simulated` | Mock/dev data | Striped navy-100 badge "Simulated data" |
| `danger` | Errors, cancellations | `#B42318` |
| `info` | Neutral notices | navy-700 on navy-100 |

Colour is never the only signal: always pair with a label or icon.

### Dark surfaces

Navy-900 sections (hero overlays, footer, admin sidebar) use cloud-50 text and gold-500 accents. A full dark mode is optional and comes later. Tokens are defined so it can be added without component changes.

## 2. Typography

| Role | Font | Notes |
|------|------|-------|
| Display / headings | **Fraunces** (variable serif, opsz) | Editorial, warm; used sparingly at large sizes |
| UI / body | **Inter** (variable) | Excellent legibility, tabular numerals for prices |
| Numerals in prices/tables | Inter `font-variant-numeric: tabular-nums` | |

Type scale (rem): 0.75 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 2 · 2.5 · 3.25 · 4.25
Body 1rem/1.6, headings line-height 1.1–1.25, max reading width ~68ch.

## 3. Spacing, radius, elevation

- 4px base grid. Section rhythm: 64px mobile, 96–128px desktop.
- Radius: `sm 6px` (inputs, badges), `md 10px` (cards, buttons), `lg 16px` (media, dialogs). No pill buttons except tags/chips.
- Elevation: one subtle shadow `0 1px 2px rgb(11 37 69 / .06), 0 8px 24px rgb(11 37 69 / .06)`. Prefer borders (`cloud-100`/`slate-300`) over shadows.
- Gold hairline (1px `gold-500`) as a signature divider under section eyebrows.

## 4. Layout

- Container max 1280px, 16px gutters on mobile, 24px tablet, 32px desktop.
- 12-column grid on desktop; vary layouts across sections (split media/text, editorial lists, asymmetric mosaics) rather than repeating card grids.
- Admin: fixed navy sidebar, cloud-50 workspace, dense but breathable tables with responsive card fallback under 768px.

## 5. Components (shadcn/ui, themed)

Button (primary navy, accent gold, secondary outline, ghost, destructive) · Input / Select / Combobox / DatePicker / DateRangePicker · TravellerPicker (adults/children/rooms) · Badge (status tokens) · PriceTag (amount, currency, basis, source label) · PriceBreakdown · Stepper (booking flow) · Card (media / plain) · Tabs · Accordion (FAQs, itinerary days) · Dialog / Sheet · Toast (Sonner) · DataTable (sort, filter, paginate) · Timeline (status history) · EmptyState · ErrorState · Skeleton · FileUpload (private, progress, validation) · Breadcrumbs · Pagination · StatTile (admin).

## 6. Imagery

- Real, high-quality destination photography (licensed; source tracked in media table with credit + licence).
- Consistent treatment: natural colour, slight navy overlay (`navy-900 / 35–55%`) only where text sits on images.
- `next/image`, AVIF/WebP, explicit sizes, lazy below the fold, blur placeholders.
- No stock photos of fake "happy customers" presented as real clients.

## 7. Motion

- Durations 150–250ms, ease-out `cubic-bezier(.2,.8,.2,1)`.
- Animate opacity/transform only. Purposeful: page section reveals (subtle), dialog/sheet enter, accordion, toast.
- `prefers-reduced-motion: reduce` → no transforms, instant transitions.

## 8. Voice & copy

Warm, clear and specific. Say what will happen ("We'll confirm availability with the hotel within 24 hours") and never overpromise. Use status words exactly: *Request received*, *Awaiting confirmation*, *Confirmed*. Estimates always say "estimated" and show their source.

## 9. Brand configuration

`src/config/brand.ts` + admin settings: name, logo (light/dark), favicon, contact email/phone/WhatsApp, address, social links, legal entity, default currency, timezone. Brand name: **ORBIS** (owner-confirmed). Wordmark set in Fraunces, uppercase with open tracking, plus a gold compass-point glyph.

## 10. Accessibility checklist

Visible focus ring (2px gold-500 on dark, 2px navy-700 on light, 2px offset) · 44×44px touch targets · semantic headings · labelled form fields · ARIA live regions for toasts and async results · keyboard-operable menus, dialogs and date pickers · skip link · alt text required on CMS media.
