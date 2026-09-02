// Shared by Host and Player so their independent local countdowns start from
// the same duration when a card is drawn — they'll drift by ordinary network
// latency, not by using different numbers.
export const QUICK_DRAW_DURATION_SEC = 15;
export const STEELMAN_DURATION_SEC = 45;
