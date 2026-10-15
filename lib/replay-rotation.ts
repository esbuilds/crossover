// Client-safe: the challenge's order, a seeded shuffle so a refresh resumes the same rotation (the seed is saved in the
// browser). Every case appears once; nothing is skipped.
export function rotation<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
