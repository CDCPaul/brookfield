/**
 * Sends one real text, to check the account works before relying on it.
 *
 *   npm run sms:test -- 09171234567
 *
 * Costs one credit. Also prints what the booking messages will look like and
 * how many credits each would cost.
 */

import {
  confirmedSms,
  newRequestSms,
  SMS_SINGLE_LIMIT,
  type RequestSummary,
} from '../lib/notify/messages';
import { isSmsConfigured, sendSms } from '../lib/notify/sms';

const SAMPLE: RequestSummary = {
  date: '2026-08-16',
  name: 'Juan Dela Cruz',
  amount: 400,
  lines: [
    { slotIndex: 6, optionKey: 'pb2', price: 200 },
    { slotIndex: 7, optionKey: 'pb2', price: 200 },
  ],
};

function preview(label: string, message: string) {
  const credits = Math.max(1, Math.ceil(message.length / 153));
  const flag = message.length <= SMS_SINGLE_LIMIT ? 'ok' : 'OVER';
  console.log(`\n${label} — ${message.length} chars, ${credits} credit(s) [${flag}]`);
  console.log(message.split('\n').map((line) => `  | ${line}`).join('\n'));
}

async function main() {
  preview('Admin: new request', newRequestSms(SAMPLE));
  preview('Booker: confirmed', confirmedSms(SAMPLE));

  const to = process.argv[2];
  if (!to) {
    console.log('\nPass a number to send a real text:');
    console.log('  npm run sms:test -- 09171234567\n');
    process.exit(0);
  }

  if (!isSmsConfigured()) {
    console.error('\nSEMAPHORE_API_KEY is not set in .env.local.\n');
    process.exit(1);
  }

  console.log(`\nSending to ${to}…`);
  const result = await sendSms([to], confirmedSms(SAMPLE));
  console.log(result.sent ? `Sent to ${result.count} number(s).` : `Failed: ${result.reason}`);
  process.exit(result.sent ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
