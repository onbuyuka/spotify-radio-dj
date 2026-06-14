/** Pick a random element, or undefined for an empty array. */
export function pick<T>(arr: readonly T[]): T | undefined {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined;
}

/** Short non-cryptographic id for ephemeral objects (segments, etc.). */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Fisher–Yates shuffle, returning a new array (input is not mutated). */
export function shuffled<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
