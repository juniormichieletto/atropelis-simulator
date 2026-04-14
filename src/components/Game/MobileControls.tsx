import React from 'react';
import './MobileControls.css';

interface MobileControlsProps {
  onInput: (input: { forward: boolean, backward: boolean, left: boolean, right: boolean }) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onInput }) => {
  const [inputState, setInputState] = React.useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  const handleTouch = (key: keyof typeof inputState, value: boolean) => {
    const newState = { ...inputState, [key]: value };
    setInputState(newState);
    onInput(newState);
  };

  return (
    <div className="mobile-controls">
      <div className="d-pad">
        <button 
          className={`control-btn left ${inputState.left ? 'active' : ''}`}
          onTouchStart={() => handleTouch('left', true)}
          onTouchEnd={() => handleTouch('left', false)}
          onMouseDown={() => handleTouch('left', true)}
          onMouseUp={() => handleTouch('left', false)}
        >L</button>
        <button 
          className={`control-btn right ${inputState.right ? 'active' : ''}`}
          onTouchStart={() => handleTouch('right', true)}
          onTouchEnd={() => handleTouch('right', false)}
          onMouseDown={() => handleTouch('right', true)}
          onMouseUp={() => handleTouch('right', false)}
        >R</button>
      </div>
      <div className="pedals">
        <button 
          className={`control-btn forward ${inputState.forward ? 'active' : ''}`}
          onTouchStart={() => handleTouch('forward', true)}
          onTouchEnd={() => handleTouch('forward', false)}
          onMouseDown={() => handleTouch('forward', true)}
          onMouseUp={() => handleTouch('forward', false)}
        >GAS</button>
        <button 
          className={`control-btn backward ${inputState.backward ? 'active' : ''}`}
          onTouchStart={() => handleTouch('backward', true)}
          onTouchEnd={() => handleTouch('backward', false)}
          onMouseDown={() => handleTouch('backward', true)}
          onMouseUp={() => handleTouch('backward', false)}
        >BRAKE</button>
      </div>
    </div>
  );
};
