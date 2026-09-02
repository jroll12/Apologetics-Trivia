// Countdown color logic, functional only — never decorative. Shared between
// the Host Display's SVG ring and the Player Controller's plain timer text so
// both change color at the exact same thresholds.
export function getTimerColor(secondsRemaining: number): string {
  if (secondsRemaining <= 3) return 'var(--color-error)';
  if (secondsRemaining <= 5) return 'var(--color-warning)';
  return 'var(--color-white)';
}
