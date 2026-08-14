/**
 * Sits to the right of the mark. Follows the BrookSide Bounce lockup: the
 * name in the serif face, a letterspaced line beneath.
 *
 * The sub-line names the village rather than the sport, because the app covers
 * the tennis and basketball courts too.
 */
export function Wordmark({ sub = 'Brookfield Subdivision' }: { sub?: string }) {
  return (
    <span className="flex min-w-0 flex-col leading-none">
      <span className="font-brand text-xl font-bold tracking-tight text-court-dark dark:text-leaf">
        BrookSide Bounce
      </span>
      <span className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-court dark:text-court-soft">
        {sub}
      </span>
    </span>
  );
}
