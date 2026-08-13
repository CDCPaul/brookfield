# Brookfield Courts

Mobile booking app for the free morning court hours at Brookfield Village,
Lapu-Lapu City. Residents check availability and reserve a slot from their
phone; the Homeowners Association manages bookings, closures and usage reports.

- **Tennis** — Mon, Wed, Fri, Sun · 1 court
- **Pickleball** — Tue, Thu, Sat · 4 courts
- **Free hours** — 6:00–9:00 AM, in three one-hour slots

Residents identify themselves with **name + phase / block / lot** — there are no
passwords or accounts. All dates and times are evaluated in **Asia/Manila**.

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
| `npm run db:studio` | Drizzle Studio |

## How it fits together

The rules live in pure, database-free modules so they can be tested exhaustively:

| Module | Responsibility |
|---|---|
| `lib/time.ts` | Manila dates, week boundaries, slot start times |
| `lib/schedule.ts` | Which sport runs on which day, courts, slots |
| `lib/unit-key.ts` | Normalizes `Phase 2A` / `ph-2a` / `2 A` to one household |
| `lib/rules.ts` | Eligibility and availability |
| `lib/queries/*` | Database access, composing the rules above |
| `app/**` | Screens and server actions |

Double-booking is prevented by a partial unique index on
`(booking_date, sport, court_no, slot_index) WHERE status = 'booked'`, so two
residents tapping the same court at the same moment cannot both succeed.

Per-household limits (1 per day, 2 per week, 7 days ahead by default) are
configurable by the association at `/admin/settings`.

## Deploying

Deploy to Vercel and set `DATABASE_URL`, `ADMIN_PASSWORD` and `AUTH_SECRET` as
environment variables. Rotate the Neon password and pick a real `AUTH_SECRET`
before going live.
