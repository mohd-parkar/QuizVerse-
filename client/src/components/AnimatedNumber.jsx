import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

// counts up/down to `value`; used for scores on the leaderboard
export default function AnimatedNumber({ value, duration = 0.8 }) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => { from.current = value; },
    });
    return () => {
      from.current = value;
      controls.stop();
    };
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}
