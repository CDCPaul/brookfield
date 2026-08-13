import { findOption } from '@/lib/courts';
import { formatUnitLabel } from '@/lib/unit-key';

/** What was actually booked, e.g. 'Pickleball court 2' or 'Basketball full court'. */
export function courtLabel(booking: { courtOption: string }): string {
  return findOption(booking.courtOption)?.label ?? booking.courtOption;
}

export type BookerFields = {
  bookerType: string;
  unitPhase: string | null;
  unitBlock: string | null;
  unitLot: string | null;
};

/**
 * A resident's household address, or null for a guest — who has no unit and is
 * already marked by the badge beside their name.
 */
export function bookerLabel(booking: BookerFields): string | null {
  if (
    booking.bookerType !== 'resident' ||
    booking.unitPhase === null ||
    booking.unitBlock === null ||
    booking.unitLot === null
  ) {
    return null;
  }

  return formatUnitLabel({
    phase: booking.unitPhase,
    block: booking.unitBlock,
    lot: booking.unitLot,
  });
}

export function GuestBadge() {
  return (
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-clay dark:bg-orange-950/50">
      Guest
    </span>
  );
}
