# State Machines

**Status:** Phase 1 · 2026-10-15

Every status change goes through one service function per domain (`transition(entity, to, actor, note)`). That function:

1. Loads the row `FOR UPDATE` inside a transaction.
2. Checks the transition is allowed for the entity's type **and** the actor has permission.
3. Runs the guard conditions listed below.
4. Writes the new status + a history row (from, to, actor, note, timestamp).
5. Enqueues side effects (notifications, hold release) as jobs with dedup keys, **after commit**.

Invalid transitions throw `InvalidTransitionError` and nothing changes.

---

## 1. Booking

### States

| State | Meaning | Customer label |
|-------|---------|----------------|
| `draft` | Being configured; not yet submitted | — (not shown) |
| `request_submitted` | Customer submitted a request-to-book | Request received |
| `awaiting_supplier` | Staff checking with supplier | Awaiting confirmation |
| `awaiting_payment` | Price/availability confirmed; payment needed | Payment required |
| `partially_paid` | Deposit/instalment received, balance outstanding | Deposit paid |
| `confirmed` | Fully confirmed by agency/supplier and payment terms met | Confirmed |
| `ticketed` | Flight tickets issued (flight/package-with-flight only) | Tickets issued |
| `in_progress` | Travel has started | On trip |
| `completed` | Travel finished | Completed |
| `cancellation_requested` | Customer asked to cancel; under review | Cancellation requested |
| `cancelled` | Cancelled (by customer, agency or supplier) | Cancelled |
| `refund_pending` | Refund approved, being processed | Refund in progress |
| `refunded` | Refund completed | Refunded |
| `failed` | Could not be fulfilled (supplier rejected, payment never completed) | Unsuccessful |
| `expired` | Hold/quote lapsed before payment | Expired |

> `confirmed` with an outstanding balance is allowed when the payment plan says a deposit secures the booking. Then `balance_minor > 0` is shown separately ("Balance due by …"). `partially_paid` is used when the deposit has been paid but supplier confirmation or the remaining terms are still pending.

### Transitions

| From → To | Who | Guards |
|-----------|-----|--------|
| draft → request_submitted | customer, system | Valid quote, not expired; travellers complete |
| draft → awaiting_payment | system (instant mode) | Supplier revalidation succeeded; hold created |
| request_submitted → awaiting_supplier | staff | — |
| request_submitted / awaiting_supplier → awaiting_payment | staff | Price confirmed; if changed from quote, a new quote must be accepted by customer |
| request_submitted / awaiting_supplier → failed | staff | Reason required |
| awaiting_payment → partially_paid | system (payment) | Verified transaction ≥ deposit, < total |
| awaiting_payment / partially_paid → confirmed | system (payment) or staff | Payment terms met **and** all items `confirmation_status = confirmed` |
| awaiting_payment → expired | system (job) | `expires_at < now()` and no verified payment; releases holds |
| confirmed → ticketed | staff, system (supplier) | Booking includes flights; ticket numbers recorded from supplier |
| confirmed / ticketed → in_progress | system (job) | `travel_start <= today` |
| in_progress → completed | system (job), staff | `travel_end < today` |
| awaiting_payment / partially_paid / confirmed / ticketed → cancellation_requested | customer, staff | Before `travel_start`; penalty computed from policy snapshot |
| cancellation_requested → (previous state) | staff | Request rejected or withdrawn |
| cancellation_requested → cancelled | staff (`booking.update_status`) | Supplier cancellation done or recorded |
| awaiting_payment / partially_paid / confirmed → cancelled | staff, supplier | Agency/supplier-initiated, reason required |
| cancelled → refund_pending | finance (`finance.refund`) | Refund record approved; amount ≤ paid − already refunded |
| refund_pending → refunded | system (provider) | Provider confirms refund |

### By booking type

| Type | Uses | Skips |
|------|------|-------|
| `package` (fixed/flexible) | all except `ticketed` unless flights included | — |
| `package` instant mode | draft → awaiting_payment directly | request_submitted, awaiting_supplier |
| `flight` | draft → awaiting_payment → confirmed → ticketed … | partially_paid (no deposits on flights by default) |
| `hotel` | draft → awaiting_payment / request_submitted → confirmed … | ticketed |
| `custom` (from enquiry) | created by staff in awaiting_payment or awaiting_supplier | draft |
| `service` (visa assistance, consultation fee) | awaiting_payment → confirmed → completed | ticketed, in_progress |

The allowed map lives in `src/server/services/booking/transitions.ts` and is fully unit-tested.

## 2. Quote

`active → accepted` (customer submits; quote frozen) · `active → expired` (job) · `active → superseded` (re-priced). Accepted quotes never change; price changes mean a new quote.

## 3. Payment attempt

`initialized → pending → succeeded | failed | abandoned`. Only server verification (webhook or verify API) moves to `succeeded`/`failed`. The browser return page only triggers a verify call. `abandoned` is set by a job after 24h with no result.

## 4. Refund

`requested → approved → processing → completed | failed`. Approver must differ from requester. `failed → processing` is allowed for a retry.

## 5. Enquiry

`new → assigned → in_progress ⇄ awaiting_customer ⇄ awaiting_supplier → converted | closed`. Any state → `closed` (reason required). `closed → in_progress` (reopen). `converted` requires `converted_booking_id`.

## 6. Consultation

`requested → confirmed → completed | no_show` · `requested/confirmed → rescheduled → confirmed` · any non-terminal → `cancelled`. A slot conflict is blocked by the DB exclusion constraint.

## 7. Visa case (configurable)

Default statuses, in order. Admins can rename them, hide them, or add new ones. Terminal states are flagged.

| Key | Customer label | Terminal |
|-----|----------------|:-:|
| `initial_assessment` | We're reviewing your details | |
| `information_requested` | We need more information | |
| `awaiting_documents` | Waiting for your documents | |
| `documents_under_review` | Reviewing your documents | |
| `preparation_in_progress` | Preparing your application pack | |
| `awaiting_appointment` | Waiting for an appointment | |
| `submitted` | Submitted (by you / by us) | |
| `awaiting_decision` | Awaiting embassy decision | |
| `additional_info_requested` | Embassy requested more information | |
| `completed` | Case completed | ✓ |
| `closed` | Closed | ✓ |

Transitions are free between non-terminal states (officers need flexibility). Moving to a terminal state requires a note. Every change writes history and notifies the customer if `customer_note` is set. **Wording never implies approval is guaranteed.** "Completed" means our service is complete. It does not mean a visa was granted.

## 8. Package / content publication

`draft → review → scheduled | published` · `scheduled → published` (job at `published_at`) · `published → draft` (unpublish) · any → `archived`. Only `catalogue.publish` / `content.manage` can move to `scheduled`/`published`.

## 9. Group trip

`planning → deciding → booking → booked → completed`, with `cancelled` reachable from any non-terminal state. Votes and expenses never move a group into `booked`. Only a linked booking reaching `confirmed` does.

## 10. Group invitation

`active → accepted` (single-use) · `active → expired` (time / max uses) · `active → revoked` (organizer).

## 11. Notification

`queued → sent | failed | suppressed` (consent or preference off). `failed → queued` on retry (max 5, exponential backoff).
