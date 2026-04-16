import React, { useState, useRef, useEffect, useCallback } from 'react';
import './MobileControls.css';

interface MobileControlsProps {
  onInput: (input: { forward: boolean, backward: boolean, left: boolean, right: boolean }) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onInput }) => {
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);

  const updateInput = useCallback((x: number, y: number) => {
    const threshold = 15;

    onInput({
      forward: y < -threshold,
      backward: y > threshold,
      left: x < -threshold,
      right: x > threshold,
    });
  }, [onInput]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 50;

    if (distance > maxRadius) {
      dx *= maxRadius / distance;
      dy *= maxRadius / distance;
    }

    setJoystickPos({ x: dx, y: dy });
    updateInput(dx, dy);
  }, [updateInput]);

  const handleEnd = useCallback(() => {
    setIsActive(false);
    touchIdRef.current = null;
    setJoystickPos({ x: 0, y: 0 });
    onInput({ forward: false, backward: false, left: false, right: false });
  }, [onInput]);

  const handleStart = (e: React.TouchEvent | React.MouseEvent, clientX: number, clientY: number) => {
    if (isActive) return;
    setIsActive(true);
    if ('changedTouches' in e) {
      touchIdRef.current = e.changedTouches[0].identifier;
    }
    handleMove(clientX, clientY);
  };

  // Global touch move/end to handle dragging outside the container
  useEffect(() => {
    if (!isActive) return;

    const onGlobalTouchMove = (e: TouchEvent) => {
      const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
      if (touch) {
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const onGlobalTouchEnd = (e: TouchEvent) => {
      const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current);
      if (touch) {
        handleEnd();
      }
    };

    const onGlobalMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onGlobalMouseUp = handleEnd;

    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd);
    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isActive, handleMove, handleEnd]);

  return (
    <div className="mobile-controls-container">
      <div 
        ref={containerRef}
        className={`joystick-base ${isActive ? 'active' : ''}`}
        onTouchStart={(e) => handleStart(e, e.touches[0].clientX, e.touches[0].clientY)}
        onMouseDown={(e) => handleStart(e, e.clientX, e.clientY)}
      >
        <div 
          className="joystick-knob"
          style={{
            transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
          }}
        />
        <div className="joystick-label up">GAS</div>
        <div className="joystick-label down">BRAKE</div>
        <div className="joystick-label left">L</div>
        <div className="joystick-label right">R</div>
      </div>
    </div>
  );
};
