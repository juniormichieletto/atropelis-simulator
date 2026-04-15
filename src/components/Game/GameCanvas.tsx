import React, { useRef, useEffect, useState } from 'react';
import './GameCanvas.css';
import { useGameLoop } from './useGameLoop';
import { PlayerCar } from './PlayerCar';
import { InputManager } from './InputManager';
import { TileMap } from './TileMap';
import { EntityManager } from './Entities';
import { MobileControls } from './MobileControls';
import { soundService } from '../../services/SoundService';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // 1 minute in seconds
  const [showControls, setShowControls] = useState(true);

  // Game Instances (initialized properly in useEffect)
  const playerRef = useRef<PlayerCar>(new PlayerCar(1100, 100));
  const inputRef = useRef<InputManager | null>(null);
  const tileMapRef = useRef<TileMap>(new TileMap());
  const entityManagerRef = useRef<EntityManager>(new EntityManager());
  const scoreRef = useRef(score);
  const onGameOverRef = useRef(onGameOver);

  // Keep refs in sync
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  useEffect(() => {
    // Lazy init InputManager once
    if (!inputRef.current) {
      inputRef.current = new InputManager();
    }

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    
    soundService.startBackgroundMusic();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onGameOverRef.current(scoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-hide controls after 5 seconds
    const controlsTimer = setTimeout(() => setShowControls(false), 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(timer);
      clearTimeout(controlsTimer);
      soundService.stopBackgroundMusic();
      if (inputRef.current) {
        inputRef.current.destroy();
        inputRef.current = null;
      }
    };
  }, []); // Only run once on mount

  const update = (dt: number) => {
    const player = playerRef.current;
    if (!inputRef.current) return;
    const input = inputRef.current.getMovementInput();
    const tileMap = tileMapRef.current;
    const entityManager = entityManagerRef.current;

    const oldX = player.x;
    const oldY = player.y;

    player.update(dt, input);

    // Wall (Building) Collision
    if (tileMap.isColliding(player.x, player.y)) {
      player.x = oldX;
      player.y = oldY;
      const collisionForce = Math.abs(player.speed);
      player.speed = -player.speed * 0.5; // Bounce back
      if (collisionForce > 20) {
        soundService.playHitSound('WALL');
      }
    }

    // Entity Collision
    entityManager.update(dt, player.x, player.y, tileMap);
    entityManager.entities.forEach(entity => {
      const dist = Math.hypot(entity.x - player.x, entity.y - player.y);
      if (dist < (player.width / 2 + entity.width / 2)) {
        // Hit!
        setScore(prev => prev + entity.points);
        entity.isAlive = false;
        soundService.playHitSound(entity.type);
        // Small speed penalty on hit for other cars
        if (entity.type === 'CAR') {
         player.speed *= 0.8;
        }
      }
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const player = playerRef.current;
    
    ctx.save();
    // ZOOM: 1.5x
    const zoom = 1.5;
    ctx.scale(zoom, zoom);
    
    // Center camera on player (adjusted for zoom)
    ctx.translate(
      (canvas.width / 2) / zoom - player.x, 
      (canvas.height / 2) / zoom - player.y
    );

    tileMapRef.current.draw(ctx, player.x, player.y, canvas.width / zoom, canvas.height / zoom);
    entityManagerRef.current.draw(ctx);
    player.draw(ctx);

    ctx.restore();

    // MINIMAP
    const mapW = 150;
    const mapH = 150;
    const mapX = canvas.width - mapW - 20;
    const mapY = 20;
    
    const { scaleX, scaleY } = tileMapRef.current.drawMinimap(ctx, mapX, mapY, mapW, mapH);
    
    // Player dot on minimap
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mapX + player.x * scaleX, mapY + player.y * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Entity dots on minimap (optional but nice)
    entityManagerRef.current.entities.forEach(e => {
        if (e.type === 'CAR') ctx.fillStyle = '#ff3333';
        else ctx.fillStyle = '#ffffcc';
        ctx.beginPath();
        ctx.arc(mapX + e.x * scaleX, mapY + e.y * scaleY, 2, 0, Math.PI * 2);
        ctx.fill();
    });
  };

  useGameLoop(update, draw);

  return (
    <div className="game-view-container">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="game-canvas"
      />

      {showControls && (
        <div className="controls-overlay" onClick={() => setShowControls(false)}>
          <div className="controls-card">
            <h3>GAME INSTRUCTIONS</h3>
            <p className="controls-title">DESKTOP CONTROLS</p>
            <p><strong>ARROW KEYS</strong> or <strong>WASD</strong> TO DRIVE</p>
            
            <div className="scoring-guide">
              <p className="scoring-title">SCORING GUIDE</p>
              <div className="score-item person">PERSON: <span className="pts">+1 PT</span></div>
              <div className="score-item bike">BIKE: <span className="pts">+2 PTS</span></div>
              <div className="score-item motorcycle">MOTORCYCLE: <span className="pts">+5 PTS</span></div>
              <div className="score-item car">OTHER CAR: <span className="pts penalty">-5 PTS</span></div>
            </div>

            <p className="hint">Tap anywhere to close</p>
          </div>
        </div>
      )}
      
      <div className="game-hud bottom">
        <div className="hud-group">
            <div className="hud-item score">SCORE: {score}</div>
            <div className="hud-item speed">SPEED: {Math.abs(Math.round(playerRef.current.speed))} KM/H</div>
        </div>
        <div className="hud-item timer">TIME: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
        <button className="quit-btn" onClick={() => onGameOver(score)}>QUIT</button>
      </div>

      <MobileControls onInput={(input) => inputRef.current?.setManualInput(input)} />
    </div>
  );
};
