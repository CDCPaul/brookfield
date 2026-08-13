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

## Deploying

Deploy to Vercel and set `DATABASE_URL`, `ADMIN_PASSWORD` and `AUTH_SECRET` as
environment variables. Rotate the Neon password and pick a real `AUTH_SECRET`
before going live.
