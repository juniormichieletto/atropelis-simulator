import { useEffect, useRef } from 'react';

export const useGameLoop = (update: (dt: number) => void, draw: () => void) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const dt = (time - previousTimeRef.current) / 1000; // in seconds
        update(dt);
        draw();
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update, draw]);
};
