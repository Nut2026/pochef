/**
 * Converts a number of days into a human-readable duration string.
 * < 30 days  → "Xd"
 * 30–364 days → "Xm"  (rounded down to whole months)
 * ≥ 365 days  → "Xy"  (rounded down to whole years)
 */
export function formatDuration(days: number): string {
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}m`;
  return `${Math.floor(days / 365)}y`;
}
