import { NextResponse } from 'next/server';

import { isAdmin } from '@/lib/auth';
import { getExportRows } from '@/lib/queries/stats';
import { SLOTS } from '@/lib/schedule';
import { isValidMonthStr, monthOf, manilaNow, monthRange } from '@/lib/time';
import { normalizePart } from '@/lib/unit-key';

export const dynamic = 'force-dynamic';

const HEADERS = [
  'Date',
  'Time',
  'Sport',
  'Court',
  'Rate',
  'Type',
  'Name',
  'Phase',
  'Block',
  'Lot',
  'Phone',
  'Status',
  'Fee',
  'Payment',
  'GCash ref',
  'Booked at',
];

/** Quotes a value for CSV, guarding against spreadsheet formula injection. */
function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const requested = new URL(request.url).searchParams.get('month');
  const month =
    requested && isValidMonthStr(requested)
      ? requested
      : monthOf(manilaNow().date);

  const { from, to } = monthRange(month);
  const rows = await getExportRows(from, to);

  const lines = [
    HEADERS.map(csvCell).join(','),
    ...rows.map((row) =>
      [
        row.date,
        SLOTS[row.slot]?.label ?? String(row.slot),
        row.sport,
        String(row.court),
        row.tier,
        row.bookerType === 'resident' ? 'Resident' : 'Guest',
        row.name,
        // Normalized so the sheet can be sorted and grouped by household.
        // Guests have no unit, so these stay blank.
        normalizePart(row.phase ?? ''),
        normalizePart(row.block ?? ''),
        normalizePart(row.lot ?? ''),
        // Leading apostrophe keeps Excel from dropping the leading zero.
        `'${row.phone}`,
        row.status,
        String(row.amount),
        row.paymentStatus,
        row.paymentRef ?? '',
        row.bookedAt.toISOString(),
      ]
        .map(csvCell)
        .join(','),
    ),
  ];

  // The BOM makes Excel read the file as UTF-8.
  const body = `﻿${lines.join('\r\n')}\r\n`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="brookfield-bookings-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
