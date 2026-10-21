import { useEffect, useState } from 'react';

// milliseconds left until `endsAt` (a local Date.now() deadline), refreshed ten times a second
export function useCountdown(endsAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt ? Math.max(0, endsAt - now) : 0;
}
