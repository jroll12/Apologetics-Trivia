import { useEffect, useRef, useState } from 'react';

/**
 * A local countdown, independent on every client (Host and each phone run
 * their own). They stay close enough in sync for a shared-room party game
 * because they all restart at the same moment they observe `activeKey`
 * change via the same real-time state sync — no shared timestamp in game
 * state is needed for that. Pass `null` for `activeKey` to hold at the full
 * duration without ticking (e.g. while a round isn't active yet).
 */
export function useCountdown(
  durationSec: number,
  activeKey: string | null,
  onExpire?: () => void
): number {
  const [secondsRemaining, setSecondsRemaining] = useState(durationSec);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setSecondsRemaining(durationSec);
    if (activeKey === null) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // Only the round identity and its duration should restart the timer —
    // an `onExpire` identity change must never do that, hence the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, durationSec]);

  return secondsRemaining;
}
