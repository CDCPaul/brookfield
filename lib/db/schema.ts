import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
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
    /** Civil date in Manila, 'YYYY-MM-DD'. */
    bookingDate: date('booking_date', { mode: 'string' }).notNull(),
    slotIndex: smallint('slot_index').notNull(),
    /** 'tennis' | 'pickleball' — derived from the date, stored for reporting. */
    sport: text('sport').notNull(),
    courtNo: smallint('court_no').notNull(),
    /** 'resident' | 'guest'. Guests are not tied to a household. */
    bookerType: text('booker_type').notNull().default('resident'),
    /** Null for guests, who have no unit in the village. */
    unitId: integer('unit_id').references(() => units.id),
    bookerName: text('booker_name').notNull(),
    /** Normalized to 09XXXXXXXXX. Doubles as the guest's identity. */
    phone: text('phone').notNull(),
    /** 'booked' | 'cancelled' | 'no_show'. */
    status: text('status').notNull().default('booked'),
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
    // The authority on double-booking. Two residents racing for the same court
    // and slot will both pass the in-memory checks; only one insert survives.
    uniqueIndex('bookings_active_slot_idx')
      .on(table.bookingDate, table.sport, table.courtNo, table.slotIndex)
      .where(sql`${table.status} = 'booked'`),
    index('bookings_date_idx').on(table.bookingDate),
    index('bookings_unit_idx').on(table.unitId),
    // Guests are identified by phone, and residents can look themselves up
    // by phone too.
    index('bookings_phone_idx').on(table.phone),
  ],
);

/** Admin-declared shutdowns: weather, maintenance, association events. */
export const closures = pgTable(
  'closures',
  {
    id: serial('id').primaryKey(),
    dateFrom: date('date_from', { mode: 'string' }).notNull(),
    dateTo: date('date_to', { mode: 'string' }).notNull(),
    /** null closes every slot that day. */
    slotIndex: smallint('slot_index'),
    /** null closes every court. */
    courtNo: smallint('court_no'),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('closures_range_idx').on(table.dateFrom, table.dateTo)],
);

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
