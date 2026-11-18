import { useEffect, useRef } from 'react';

export const useGameLoop = (
  update: (dt: number) => void,
  draw: () => void,
  isPaused: boolean = false
) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number | null>(null);
  const updateRef = useRef(update);
  const drawRef = useRef(draw);

  useEffect(() => {
    updateRef.current = update;
    drawRef.current = draw;
  });

  useEffect(() => {
    if (isPaused) {
      cancelAnimationFrame(requestRef.current);
      previousTimeRef.current = null;
      return;
    }

    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const dt = Math.min((time - previousTimeRef.current) / 1000, 0.1); // in seconds, clamped to avoid tab-switch spikes
        updateRef.current(dt);
        drawRef.current();
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPaused]);
};
