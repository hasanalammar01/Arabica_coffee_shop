/** Why a new admin PIN isn't acceptable, or null if it's fine. Browser-safe (Settings uses it too). */
export function pinProblem(pin: string): string | null {
  if (!/^[0-9]{4}$/.test(pin)) return "The PIN must be exactly 4 digits.";
  const d = [...pin].map(Number);
  const steps = new Set(d.slice(1).map((n, i) => n - d[i]));
  // All the same (0000), or a straight run up or down (1234, 4321).
  if (steps.size === 1 && [0, 1, -1].includes([...steps][0]))
    return "That PIN is too easy to guess. Avoid repeated digits and runs like 1234.";
  return null;
}
