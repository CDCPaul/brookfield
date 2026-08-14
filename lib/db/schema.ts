import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * A household. Created on first booking rather than pre-registered, then
 * curated by the association from the admin screens.
 */
export const units = pgTable(
  'units',
  {
    id: serial('id').primaryKey(),
    // The raw text the resident typed, kept for display and for the admin.
    phase: text('phase').notNull(),
    block: text('block').notNull(),
    lot: text('lot').notNull(),
    // Normalized identity: see lib/unit-key.ts.
    unitKey: text('unit_key').notNull(),
    isBlocked: boolean('is_blocked').notNull().default(false),
    blockedReason: text('blocked_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('units_unit_key_idx').on(table.unitKey)],
);

export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    /** Six-character reference shown to the resident. */
    code: text('code').notNull(),
    /**
     * Shared by slots requested together, so several hours are paid for and
     * decided as one. Equal to the first booking's code.
     */
    groupCode: text('group_code'),
    /** Civil date in Manila, 'YYYY-MM-DD'. */
    bookingDate: date('booking_date', { mode: 'string' }).notNull(),
    slotIndex: smallint('slot_index').notNull(),
    /**
     * What was actually played: 'tennis' | 'pickleball' | 'basketball'.
     * Taken from the court option, not the date — the basketball court is
     * open every day regardless of the tennis/pickleball rotation.
     */
    sport: text('sport').notNull(),
    /** Key from lib/courts.ts: 'tennis', 'pb1'…'pb4', 'bbA', 'bbB', 'bbFull'. */
    courtOption: text('court_option').notNull().default('tennis'),
    /** Legacy display number. Kept for exports; conflicts use the resources. */
    courtNo: smallint('court_no').notNull().default(1),
    /** 'resident' | 'guest'. Guests are not tied to a household. */
    bookerType: text('booker_type').notNull().default('resident'),
    /** 'free' | 'day' | 'night' — priced at the time of booking. */
    tier: text('tier').notNull().default('free'),
    /** Pesos owed for this slot. Zero for the free morning. */
    amount: integer('amount').notNull().default(0),
    /** 'none' for free slots, otherwise 'unpaid' | 'submitted' | 'paid'. */
    paymentStatus: text('payment_status').notNull().default('none'),
    /** GCash reference number the payer typed in, for the admin to match. */
    paymentRef: text('payment_ref'),
    /**
     * Blob pathname of the payment screenshot — the store is private, so this
     * is not a URL anyone can open. Cleared once it is old enough.
     */
    paymentProofUrl: text('payment_proof_url'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    /** Null for guests, who have no unit in the village. */
    unitId: integer('unit_id').references(() => units.id),
    bookerName: text('booker_name').notNull(),
    /** Normalized to 09XXXXXXXXX. Doubles as the guest's identity. */
    phone: text('phone').notNull(),
    /**
     * 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'no_show'.
     * Every booking starts as a request the association has to approve.
     */
    status: text('status').notNull().default('pending'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Free-text note from the association, shown when a request is rejected. */
    decisionNote: text('decision_note'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /** 'resident' | 'admin'. */
    cancelledBy: text('cancelled_by'),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('bookings_code_idx').on(table.code),
    index('bookings_status_idx').on(table.status),
    index('bookings_group_idx').on(table.groupCode),
    index('bookings_date_idx').on(table.bookingDate),
    index('bookings_unit_idx').on(table.unitId),
    // Guests are identified by phone, and residents can look themselves up
    // by phone too.
    index('bookings_phone_idx').on(table.phone),
  ],
);

/**
 * The physical pieces of court a booking occupies.
 *
 * This is what actually prevents double-booking. A row exists only while the
 * booking holds its slot, so cancelling or declining simply deletes the rows
 * and frees the resource — no status to keep in sync. Playing tennis inserts
 * four rows (one per quarter of the tennis court), which is why a single
 * pickleball booking makes tennis impossible for that hour.
 */
export const bookingResources = pgTable(
  'booking_resources',
  {
    bookingId: integer('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    bookingDate: date('booking_date', { mode: 'string' }).notNull(),
    slotIndex: smallint('slot_index').notNull(),
    /** 'T1'–'T4' (tennis court quarters) or 'B1'/'B2' (basketball halves). */
    resourceKey: text('resource_key').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bookingId, table.resourceKey] }),
    uniqueIndex('booking_resources_slot_idx').on(
      table.bookingDate,
      table.slotIndex,
      table.resourceKey,
    ),
    index('booking_resources_date_idx').on(table.bookingDate),
  ],
);

/** Admin-declared shutdowns: weather, maintenance, association events. */
export const closures = pgTable(
  'closures',
  {
    id: serial('id').primaryKey(),
    dateFrom: date('date_from', { mode: 'string' }).notNull(),
    dateTo: date('date_to', { mode: 'string' }).notNull(),
    /**
     * Inclusive slot range. Null on both means the whole day, which is what a
     * washed-out morning or a day of works actually looks like.
     */
    slotFrom: smallint('slot_from'),
    slotTo: smallint('slot_to'),
    /** 'tennis-court' | 'basketball-court'; null closes both surfaces. */
    venue: text('venue'),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('closures_range_idx').on(table.dateFrom, table.dateTo)],
);

/**
 * People the association has stopped from booking.
 *
 * Keyed on the mobile number because that is the one identity everybody has —
 * an address is only given up for free court time, so a household blocklist
 * would miss every paid booking.
 */
export const blockedPhones = pgTable('blocked_phones', {
  /** Normalized to 09XXXXXXXXX. */
  phone: text('phone').primaryKey(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Key-value knobs the association can change without a deploy. */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type ClosureRow = typeof closures.$inferSelect;
export type NewClosure = typeof closures.$inferInsert;
export type BookingResource = typeof bookingResources.$inferSelect;
