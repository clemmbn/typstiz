/**
 * Seedable PRNG for reproducible expression sequences.
 *
 * mulberry32 is tiny, fast and good enough for game content (not for cryptography). String seeds
 * are hashed with cyrb53-style mixing into a 32-bit state. The same seed string always yields
 * the same sequence, which enables reproducible runs, daily challenges and server-side
 * recomputation later.
 */

export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** Uniformly pick an element. */
  pick<T>(items: readonly T[]): T;
};

/**
 * Hash a string seed into a 32-bit unsigned integer.
 * @param seed - arbitrary string
 * @returns 32-bit hash
 */
export function hashSeed(seed: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

/**
 * Create a mulberry32 generator.
 * @param seed - string seed (hashed) or numeric 32-bit state
 * @returns Rng instance with its own state
 */
export function createRng(seed: string | number): Rng {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/**
 * Make a short random seed for runs where the player did not enter one.
 * Uses Math.random on purpose: this is the only non-deterministic entry point.
 * @returns 8-char base36 seed
 */
export function randomSeed(): string {
  return Math.floor(Math.random() * 36 ** 8).toString(36).padStart(8, '0');
}
