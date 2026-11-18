import { useEffect, useState } from 'react';

/** Time until the next local midnight, when daily limits reset: "5h 12m", "48m". */
export function resetInText(now = new Date()): string {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** The same, kept up to date while the screen is open. */
export function useResetIn(): string {
  const [text, setText] = useState(() => resetInText());
  useEffect(() => {
    const t = setInterval(() => setText(resetInText()), 30_000);
    return () => clearInterval(t);
  }, []);
  return text;
}
