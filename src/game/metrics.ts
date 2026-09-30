/**
 * Per-expression metrics tracker (spec §8.1).
 *
 * Framework-free and clock-injected so it is unit-testable. The UI feeds it every input change
 * (previous value, next value, timestamp) and every settled compile outcome.
 *
 * - Deletions are computed from a prefix/suffix diff of the input value, so held-down backspace,
 *   selection deletes and replace-by-typing are all counted by characters actually removed.
 * - Failed compiles are only counted for *settled* input states (reported by the caller after
 *   ~400 ms idle), and at most once per distinct input value.
 */

export type EditDiff = { inserted: number; removed: number };

/**
 * Compute how many characters were inserted and removed between two input values.
 * Uses the longest common prefix and suffix, which is exact for single contiguous edits (the only
 * kind a textarea produces per input event).
 * @param prev - value before the edit
 * @param next - value after the edit
 * @returns inserted and removed character counts
 */
export function diffEdit(prev: string, next: string): EditDiff {
  let prefix = 0;
  const maxPrefix = Math.min(prev.length, next.length);
  while (prefix < maxPrefix && prev[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  const maxSuffix = maxPrefix - prefix;
  while (suffix < maxSuffix && prev[prev.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  return { removed: prev.length - prefix - suffix, inserted: next.length - prefix - suffix };
}

export class ItemMetricsTracker {
  /** Timestamp of the first keystroke; null until the player starts typing. */
  startedAt: number | null = null;
  keystrokes = 0;
  deletions = 0;
  failedCompiles = 0;
  hints = 0;
  private lastFailedValue: string | null = null;

  /**
   * Record one input event.
   * @param prev - value before the event
   * @param next - value after the event
   * @param now - event timestamp in ms (performance.now())
   */
  onInput(prev: string, next: string, now: number): void {
    if (this.startedAt === null) this.startedAt = now;
    const { inserted, removed } = diffEdit(prev, next);
    if (inserted > 0) this.keystrokes++;
    this.deletions += removed;
  }

  /**
   * Record one revealed hint. Also starts the item clock, so hints can't be read for free.
   * @param now - event timestamp in ms
   */
  onHint(now: number): void {
    if (this.startedAt === null) this.startedAt = now;
    this.hints++;
  }

  /**
   * Record the compile outcome of an input value that stayed unchanged for the settle delay.
   * @param value - settled input value
   * @param ok - whether it compiled
   */
  onSettled(value: string, ok: boolean): void {
    // Empty input is not a mistake, and the same broken value is only counted once.
    if (ok || value.trim() === '' || value === this.lastFailedValue) return;
    this.lastFailedValue = value;
    this.failedCompiles++;
  }

  /**
   * @param now - current timestamp in ms
   * @returns elapsed ms since the first keystroke, 0 if not started
   */
  elapsed(now: number): number {
    return this.startedAt === null ? 0 : Math.max(0, now - this.startedAt);
  }
}
