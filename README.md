# Brookfield Courts

Mobile booking app for the free morning court hours at Brookfield Village,
Lapu-Lapu City. Residents check availability and reserve a slot from their
phone; the Homeowners Association manages bookings, closures and usage reports.

- **Tennis** — Mon, Wed, Fri, Sun · 1 court
- **Pickleball** — Tue, Thu, Sat · 4 courts
- **Courts open** 6:00 AM – midnight, in one-hour slots

| Block | Hours | Who | Price per hour |
|---|---|---|---|
| Free morning | 6:00–9:00 AM | Residents only | Free |
| Daytime | 9:00 AM–6:00 PM | Residents and guests | ₱350 tennis · ₱200 pickleball |
| Evening | 6:00 PM–midnight | Residents and guests | ₱400 tennis · ₱250 pickleball |

Residents identify themselves with **name + phase / block / lot**; guests give a
name and mobile number. There are no passwords or accounts. All dates and times
are evaluated in **Asia/Manila**.

Every booking is a **request**: it holds its slot but is not confirmed until the
association approves it. Paid bookings are settled through the association's own
GCash account — the payer quotes the booking reference and enters the GCash
reference number, which the association matches before approving. No payment
integration or merchant account is involved.

## Setup

```bash
npm install
```

Create `.env.local`:

```
DATABASE_URL="postgresql://…-pooler….neon.tech/neondb?sslmode=require"
ADMIN_PASSWORD="choose-something-long"
AUTH_SECRET="32+ random characters"
```

Push the schema to the database, then start the dev server:

```bash
npm run db:push
npm run dev
```

The resident app is at `/`, the association console at `/admin`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm test` | Unit tests for the scheduling and booking rules |
| `npm run smoke` | End-to-end check against the real database (cleans up after itself) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:push` | Apply `lib/db/schema.ts` to the database |
| `npm run db:repair` | Rebuild the partial unique index (see below) |
| `npm run db:clear -- --yes` | Wipe all bookings and units before go-live |
| `npm run db:studio` | Drizzle Studio |
| `npm run sms:test` | Preview the text messages and their credit cost |
| `npm run sms:test -- 09171234567` | Send one real text (costs a credit) |

> **After every `db:push`, run `npm run smoke`.** `drizzle-kit push` does not
> notice changes to the *predicate* of a partial index — it leaves the old
> `WHERE` clause in place and still reports success. That silently disables the
> double-booking guard. The smoke test asserts the predicate directly, and
> `npm run db:repair` rebuilds it.

## How it fits together

The rules live in pure, database-free modules so they can be tested exhaustively:

| Module | Responsibility |
|---|---|
| `lib/time.ts` | Manila dates, week boundaries, slot start times |
| `lib/schedule.ts` | Sport per day, the 18 hourly slots, tiers and pricing |
| `lib/unit-key.ts` | Normalizes `Phase 2A` / `ph-2a` / `2 A` to one household |
| `lib/owner.ts` | Who a booking belongs to — a household or a mobile number |
| `lib/rules.ts` | Eligibility, pricing and availability |
| `lib/queries/*` | Database access, composing the rules above |
| `app/**` | Screens and server actions |

Double-booking is prevented by a partial unique index on
`(booking_date, sport, court_no, slot_index)` covering every status except
`cancelled` and `rejected`, so a pending request holds its slot and two people
tapping the same court at the same moment cannot both succeed.

Free-hour limits (1 per day, 2 per week, 7 days ahead by default) count only
free bookings — paid hours are never capped. Limits key on the household for
residents and on the mobile number for guests, so choosing "guest" is not a way
around them. Hours, prices, GCash details and limits are all editable at
`/admin/settings`.

## Text messages

Semaphore bills one credit per 160 characters and segments at 153 after that,
so a message that drifts one character over costs double. Every template in
`lib/notify/messages.ts` is written to fit one credit and the tests hold them
there — check `npm run sms:test` before changing the wording.

Texting is never a condition of booking: if Semaphore is unconfigured, down or
out of credit, the booking still goes through and the failure is logged. Free
morning bookings are quiet by default, since there is no payment to chase.

Who gets texted, and about what, is set at `/admin/settings`.

## Known trade-offs

**Anyone who knows a mobile number can see and cancel that person's bookings.**
There are no accounts, and the number is the identity — so looking one up is
all it takes. This is deliberate: passwords would keep residents off the app
entirely, and in a village the practical risk is low. Every cancellation is
recorded with who did it, so the association can see what happened.

If it ever needs tightening, the smallest fix is to ask for the six-character
booking reference when cancelling — lookup stays easy, but the reference only
appears on the booker's own screen.

**"Your next booking" on the home screen is not a session.** The device
remembers what was typed the last time it booked and asks the server about that
number. Nothing identifies the visitor server-side, so a shared phone shows
whoever booked on it last.

## Deploying

Deploy to Vercel and set `DATABASE_URL`, `ADMIN_PASSWORD` and `AUTH_SECRET` as
environment variables. Rotate the Neon password and pick a real `AUTH_SECRET`
before going live.
