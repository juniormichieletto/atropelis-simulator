import React, { useRef, useEffect, useState } from 'react';
import './GameCanvas.css';
import { useGameLoop } from './useGameLoop';
import { PlayerCar } from './PlayerCar';
import { InputManager } from './InputManager';
import { TileMap } from './TileMap';
import { EntityManager } from './Entities';
import { soundService } from '../../services/SoundService';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
}

interface ScorePopup {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // 1 minute in seconds
  const [showControls, setShowControls] = useState(true);

  // Start on a main city road facing East (angle = 0)
  const playerRef = useRef<PlayerCar>(new PlayerCar(450, 850));
  const inputRef = useRef<InputManager | null>(null);
  const tileMapRef = useRef<TileMap>(new TileMap());
  const entityManagerRef = useRef<EntityManager>(new EntityManager());
  const scoreRef = useRef(score);
  const showControlsRef = useRef(showControls);
  const onGameOverRef = useRef(onGameOver);
  const speedTextRef = useRef<HTMLSpanElement>(null);
  const gearTextRef = useRef<HTMLSpanElement>(null);
  const rpmFillRef = useRef<HTMLDivElement>(null);

  const isPointerDownRef = useRef(false);
  const shakeTimerRef = useRef(0);
  const popupsRef = useRef<ScorePopup[]>([]);
  const nextPopupIdRef = useRef(1);

  // Keep refs in sync
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { showControlsRef.current = showControls; }, [showControls]);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onGameOverRef.current(scoreRef.current);
    }
  }, [timeLeft]);

  const handleInteraction = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    playerRef.current.setPointerScreenX(clientX, canvas.width);
  };

  useEffect(() => {
    if (!inputRef.current) {
      inputRef.current = new InputManager();
    }

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDownDismiss = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        setShowControls(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownDismiss);

    const isHudTarget = (target: EventTarget | null) => {
      return target instanceof Element && Boolean(target.closest('.game-hud') || target.closest('.quit-btn'));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isHudTarget(e.target)) return;
      isPointerDownRef.current = true;
      handleInteraction(e.clientX);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPointerDownRef.current) {
        handleInteraction(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isPointerDownRef.current = false;
      playerRef.current.clearTarget();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isHudTarget(e.target)) return;
      isPointerDownRef.current = true;
      if (e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isPointerDownRef.current && e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      isPointerDownRef.current = false;
      playerRef.current.clearTarget();
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    soundService.startBackgroundMusic();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const controlsTimer = setTimeout(() => setShowControls(false), 4000);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDownDismiss);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      clearInterval(timer);
      clearTimeout(controlsTimer);
      soundService.stopBackgroundMusic();
      if (inputRef.current) {
        inputRef.current.destroy();
        inputRef.current = null;
      }
    };
  }, []);

  const update = (dt: number) => {
    const player = playerRef.current;
    if (!inputRef.current) return;
    const input = inputRef.current.getMovementInput();
    const tileMap = tileMapRef.current;
    const entityManager = entityManagerRef.current;

    const oldX = player.x;
    const oldY = player.y;

    // Auto-accelerate is active once the controls overlay is dismissed
    player.update(dt, {
      ...input,
      autoAccelerate: !showControlsRef.current,
    });

    // Update continuous Top Gear 3000 engine sound & 5-speed transmission pitch
    soundService.updateEngineSound(player.speed, player.steerVisual, player.isBraking);

    // Wall (Building / Water) Hull Collision with smooth wall-sliding & angular deflection
    const hullRadius = 15;
    if (tileMap.isColliding(player.x, player.y, hullRadius)) {
      const collisionForce = Math.abs(player.speed);
      const canSlideX = !tileMap.isColliding(player.x, oldY, hullRadius);
      const canSlideY = !tileMap.isColliding(oldX, player.y, hullRadius);

      if (canSlideX) {
        player.y = oldY;
        player.speed *= 0.94;
        // Gently align car heading toward the horizontal street axis (0 or PI)
        const targetAxis = Math.cos(player.angle) >= 0 ? 0 : Math.PI;
        let diff = targetAxis - player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        player.angle += diff * Math.min(1, dt * 6);
      } else if (canSlideY) {
        player.x = oldX;
        player.speed *= 0.94;
        // Gently align car heading toward the vertical street axis (PI/2 or -PI/2)
        const targetAxis = Math.sin(player.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2;
        let diff = targetAxis - player.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        player.angle += diff * Math.min(1, dt * 6);
      } else {
        player.x = oldX;
        player.y = oldY;
        player.speed = -player.speed * 0.45; // Bounce back on head-on hit
        // Nudge angle slightly so auto-accelerate doesn't trap the car in a 90-degree bounce loop
        player.angle += (player.steerVisual >= 0 ? 1 : -1) * 0.32;
      }

      if (collisionForce > 45 && shakeTimerRef.current <= 0) {
        soundService.playHitSound('WALL');
        shakeTimerRef.current = 0.15;
      }
    }

    // Update screen shake timer & floating score popups
    if (shakeTimerRef.current > 0) {
      shakeTimerRef.current = Math.max(0, shakeTimerRef.current - dt);
    }

    popupsRef.current.forEach(p => {
      p.y -= 55 * dt;
      p.life -= dt;
    });
    popupsRef.current = popupsRef.current.filter(p => p.life > 0);

    // Entity Collision (Oriented Bounding Box matching 3D rear-view supercar bumper & fenders)
    const cosP = Math.cos(player.angle);
    const sinP = Math.sin(player.angle);
    entityManager.update(dt, player.x, player.y, tileMap, player.angle);

    entityManager.entities.forEach(entity => {
      if (!entity.isAlive || entity.isHit) return;

      const dx = entity.x - player.x;
      const dy = entity.y - player.y;
      // Transform entity offset into car's local coordinate frame
      const forwardDist = dx * cosP + dy * sinP;
      const lateralDist = -dx * sinP + dy * cosP;

      const halfFront = 26 + entity.width * 0.4;
      const halfRear = 14 + entity.width * 0.3;
      const halfWidth = 22 + entity.width * 0.45;

      if (
        forwardDist >= -halfRear &&
        forwardDist <= halfFront &&
        Math.abs(lateralDist) <= halfWidth
      ) {
        // Hit! Launch entity into 3D accident flight before despawning
        setScore(prev => prev + entity.points);
        entity.triggerHit(player.x, player.y, player.angle, player.speed);
        soundService.playHitSound(entity.type);
        shakeTimerRef.current = entity.type === 'CAR' ? 0.22 : 0.1;

        const canvas = canvasRef.current;
        if (canvas) {
          const sign = entity.points > 0 ? '+' : '';
          popupsRef.current.push({
            id: nextPopupIdRef.current++,
            text: `${sign}${entity.points} PTS`,
            color: entity.points > 0 ? '#00e5ff' : '#ff2a85',
            x: canvas.width * 0.5 + (Math.random() - 0.5) * 90,
            y: canvas.height - 155,
            life: 0.85,
          });
        }

        // Speed penalty & slight deflection on hit for other cars
        if (entity.type === 'CAR') {
          player.speed *= 0.65;
          player.angle += (lateralDist >= 0 ? -1 : 1) * 0.15;
        }
      }
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const player = playerRef.current;
    const tileMap = tileMapRef.current;
    const entityManager = entityManagerRef.current;

    // 3D Camera parameters (Behind-the-Car Top Gear 3000 view) with anti-wall-clipping raycast
    const camAngle = player.angle - player.steerVisual * 0.1;
    const cosCam = Math.cos(camAngle);
    const sinCam = Math.sin(camAngle);
    let camDist = 82;
    for (let testDist = 20; testDist <= 82; testDist += 12) {
      const testX = player.x - cosCam * testDist;
      const testY = player.y - sinCam * testDist;
      if (tileMap.isColliding(testX, testY, 8)) {
        camDist = Math.max(24, testDist - 12);
        break;
      }
    }
    const camX = player.x - cosCam * camDist;
    const camY = player.y - sinCam * camDist;
    const camHeight = 52;

    const shakeX = shakeTimerRef.current > 0 ? (Math.random() - 0.5) * 10 : 0;
    const shakeY = shakeTimerRef.current > 0 ? (Math.random() - 0.5) * 10 : 0;
    const horizonY = Math.floor(H * 0.38) + Math.round(player.bounceOffset * 0.5) + shakeY;
    const focalLength = W * 0.65;

    ctx.save();
    if (shakeX !== 0) {
      ctx.translate(shakeX, 0);
    }

    // 1. Draw Sky, Parallax Horizon & Mode 7 Ground Plane
    tileMap.drawSkyAndGround(ctx, camX, camY, camAngle, camHeight, horizonY, focalLength, W, H);

    // 2. Collect and Depth-Sort 3D Buildings, Roadside Neon Props & 3D Entities
    const buildingDrawables = tileMap.getVisibleBuildingDrawables(
      camX,
      camY,
      camAngle,
      camHeight,
      horizonY,
      focalLength,
      W
    );
    const entityDrawables = entityManager.getVisibleEntityDrawables(
      camX,
      camY,
      camAngle,
      camHeight,
      horizonY,
      focalLength,
      W
    );

    const allDrawables = [...buildingDrawables, ...entityDrawables];
    allDrawables.sort((a, b) => b.depth - a.depth);
    for (const item of allDrawables) {
      item.draw(ctx);
    }

    // 3. Draw Player Car in Top Gear 3000 Behind-the-Car Perspective
    player.drawRearView(ctx, W, H);

    // 4. Draw Floating Hit Score Popups
    for (const p of popupsRef.current) {
      ctx.save();
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#09051d';
      ctx.fillText(p.text, p.x + 2, p.y + 2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }

    ctx.restore();

    // 5. RADAR MINIMAP (with 3D Camera View Cone)
    const mapW = 150;
    const mapH = 150;
    const mapX = W - mapW - 20;
    const mapY = 20;

    const { scaleX, scaleY } = tileMap.drawMinimap(ctx, mapX, mapY, mapW, mapH);

    // Entity dots on radar minimap
    entityManager.entities.forEach(e => {
      ctx.fillStyle = e.type === 'CAR' ? '#ff2a85' : '#ffbe0b';
      ctx.beginPath();
      ctx.arc(mapX + e.x * scaleX, mapY + e.y * scaleY, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Camera FOV Cone on radar minimap
    const px = mapX + player.x * scaleX;
    const py = mapY + player.y * scaleY;
    const coneLen = 30;
    const fovHalf = 0.55;
    ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(camAngle - fovHalf) * coneLen, py + Math.sin(camAngle - fovHalf) * coneLen);
    ctx.lineTo(px + Math.cos(camAngle + fovHalf) * coneLen, py + Math.sin(camAngle + fovHalf) * coneLen);
    ctx.closePath();
    ctx.fill();

    // Player dot on radar minimap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Update Top Gear 3000 HUD Tachometer, Gear & Speed via Refs
    const absSpeed = Math.abs(Math.round(player.speed));
    const gearNum = player.speed < -5 ? 'R' : Math.min(5, Math.max(1, Math.ceil(absSpeed / 72))).toString();
    const rpmPct = Math.min(100, Math.round((absSpeed / player.maxSpeed) * 100));

    if (speedTextRef.current) {
      speedTextRef.current.textContent = `${absSpeed.toString().padStart(3, '0')} KM/H`;
    }
    if (gearTextRef.current) {
      gearTextRef.current.textContent = `G${gearNum}`;
    }
    if (rpmFillRef.current) {
      rpmFillRef.current.style.width = `${rpmPct}%`;
    }
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
        <div
          className="controls-overlay"
          onClick={() => {
            soundService.playUiSound();
            setShowControls(false);
          }}
        >
          <div className="controls-card">
            <h3>TOP GEAR 3000 MODE</h3>
            <p className="controls-title">CONTROLS (AUTO-GAS)</p>
            <p><strong>A / D</strong> or <strong>LEFT / RIGHT ARROWS</strong> TO STEER</p>
            <p><strong>HOLD LEFT / RIGHT SCREEN</strong> TO STEER (TOUCH/MOUSE)</p>
            <p><strong>W / UP</strong> NITRO BOOST &bull; <strong>S / DOWN</strong> BRAKE / REV</p>

            <div className="scoring-guide">
              <p className="scoring-title">TARGET DATA</p>
              <div className="score-item person">PERSON: <span className="pts">+1 PT</span></div>
              <div className="score-item bike">BIKE: <span className="pts">+2 PTS</span></div>
              <div className="score-item motorcycle">MOTORCYCLE: <span className="pts">+5 PTS</span></div>
              <div className="score-item car">TRAFFIC CAR: <span className="pts penalty">-5 PTS</span></div>
            </div>

            <p className="hint">Tap or press any key to launch</p>
          </div>
        </div>
      )}

      <div className="game-hud bottom">
        <div className="hud-group">
          <div className="hud-item score">SCORE: {score}</div>
          <div className="hud-item speed">
            <div className="tach-row">
              <span ref={gearTextRef} className="gear-badge">G1</span>
              <span ref={speedTextRef}>000 KM/H</span>
            </div>
            <div className="rpm-bar-track">
              <div ref={rpmFillRef} className="rpm-bar-fill" />
            </div>
          </div>
        </div>
        <div className="hud-group right">
          <div className="hud-item timer">TIME: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</div>
          <button
            className="quit-btn"
            onClick={() => {
              soundService.playUiSound();
              onGameOver(score);
            }}
          >
            ABORT
          </button>
        </div>
      </div>
    </div>
  );
};
