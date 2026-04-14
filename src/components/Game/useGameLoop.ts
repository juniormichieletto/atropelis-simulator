import { useEffect, useRef } from 'react';

export const useGameLoop = (update: (dt: number) => void, draw: () => void) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const dt = (time - previousTimeRef.current) / 1000; // in seconds
      update(dt);
      draw();
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);
};
