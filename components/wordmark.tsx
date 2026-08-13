/**
 * Mirrors the Brookfield Subdivision lockup: the name in the serif wordmark
 * with a letterspaced line beneath it.
 */
export function Wordmark({ sub = 'Courts' }: { sub?: string }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-brand text-2xl font-bold tracking-tight text-court-dark dark:text-leaf">
        Brookfield
      </span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.35em] text-court dark:text-court-soft">
        {sub}
      </span>
    </span>
  );
}
