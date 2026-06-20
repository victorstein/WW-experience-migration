// Seconds left on the shared "Refresh all" cooldown. Derived from the absolute
// server trigger time (lastSweepTs) so every client converges on the same value;
// the client ticks `nowSec` locally for a smooth countdown without server chatter.
export function sweepRemaining(lastSweepTs: number, cooldown: number, nowSec: number): number {
  if (!lastSweepTs) return 0;
  return Math.max(0, Math.round(lastSweepTs + cooldown - nowSec));
}
