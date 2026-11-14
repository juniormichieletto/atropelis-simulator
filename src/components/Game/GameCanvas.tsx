import React, { useRef, useEffect, useState } from 'react';
import './GameCanvas.css';
import { useGameLoop } from './useGameLoop';
import { PlayerCar } from './PlayerCar';
import { InputManager } from './InputManager';
import { TileMap } from './TileMap';
import { EntityManager, Entity } from './Entities';
import { soundService } from '../../services/SoundService';
import { MultiplayerService, MULTIPLAYER_CAR_COLORS } from '../../services/MultiplayerService';
import { RemotePlayerManager } from './RemotePlayerManager';
import { LocalStorageService } from '../../services/LocalStorageService';
import { getPlayerSpawnPoint } from './SpawnPoints';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  multiplayerService?: MultiplayerService;
  onBackToMenu?: () => void;
}

interface ScorePopup {
  id: number;
  text: string;
  color: string;
  x: number;
  y: number;
  life: number;
}

export interface MpLeaderboardRacer {
  id: string;
  name: string;
  score: number;
  color: string;
  isLocal: boolean;
  isDisconnected?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onGameOver,
  multiplayerService,
  onBackToMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // 1 minute in seconds
  const [showControls, setShowControls] = useState(true);
  const [isPaused, setIsPaused] = useState(() => (multiplayerService ? false : document.hidden));
  const [peerCount, setPeerCount] = useState(() => (multiplayerService ? multiplayerService.getConnectedPeers().length : 1));
  const [mpFinalResults, setMpFinalResults] = useState<{ rank: number; racers: MpLeaderboardRacer[] } | null>(null);
  const mpFinalResultsRef = useRef<{ rank: number; racers: MpLeaderboardRacer[] } | null>(null);
  const [liveMpScores, setLiveMpScores] = useState<MpLeaderboardRacer[]>([]);

  const initialSpawn = multiplayerService
    ? getPlayerSpawnPoint(multiplayerService.getMySpawnIndex(), multiplayerService.getSpawnSeed())
    : { x: 450, y: 850, angle: 0 };
  const playerRef = useRef<PlayerCar>(new PlayerCar(initialSpawn.x, initialSpawn.y, initialSpawn.angle));
  const inputRef = useRef<InputManager | null>(null);
  const tileMapRef = useRef<TileMap>(new TileMap());
  const entityManagerRef = useRef<EntityManager>(new EntityManager());
  const remotePlayerManagerRef = useRef<RemotePlayerManager>(new RemotePlayerManager());
  const scoreRef = useRef(score);
  const showControlsRef = useRef(showControls);
  const onGameOverRef = useRef(onGameOver);
  const isPausedRef = useRef(Boolean(!multiplayerService && document.hidden));
  const speedTextRef = useRef<HTMLSpanElement>(null);
  const gearTextRef = useRef<HTMLSpanElement>(null);
  const rpmFillRef = useRef<HTMLDivElement>(null);

  const isPointerDownRef = useRef(false);
  const shakeTimerRef = useRef(0);
  const popupsRef = useRef<ScorePopup[]>([]);
  const nextPopupIdRef = useRef(1);
  const lastNetworkSendRef = useRef(0);
  const lastNpcSendRef = useRef(0);
  const playerHitCooldownRef = useRef(multiplayerService ? 2.5 : 0);

  const refreshMpLeaderboard = () => {
    if (!multiplayerService) return;
    const localRacer: MpLeaderboardRacer = {
      id: multiplayerService.myId,
      name: multiplayerService.myName,
      score: scoreRef.current,
      color: multiplayerService.myColor,
      isLocal: true,
      isDisconnected: false,
    };
    const remotes: MpLeaderboardRacer[] = Array.from(
      remotePlayerManagerRef.current.players.values()
    ).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      color: p.color,
      isLocal: false,
      isDisconnected: p.isDisconnected,
    }));
    const sorted = [localRacer, ...remotes].sort((a, b) => b.score - a.score);
    setLiveMpScores(sorted);
  };

  // Keep refs in sync
  useEffect(() => {
    scoreRef.current = score;
    if (multiplayerService) {
      refreshMpLeaderboard();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, multiplayerService]);

  useEffect(() => { showControlsRef.current = showControls; }, [showControls]);
  useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);

  // Configure multiplayer callbacks and custom car palette if in multiplayer mode
  useEffect(() => {
    if (!multiplayerService) return;

    // Apply player's unique randomized spawn point and start grace period
    const spawn = getPlayerSpawnPoint(
      multiplayerService.getMySpawnIndex(),
      multiplayerService.getSpawnSeed()
    );
    playerRef.current.x = spawn.x;
    playerRef.current.y = spawn.y;
    playerRef.current.angle = spawn.angle;
    playerHitCooldownRef.current = 2.5;

    // Apply player's selected car palette
    const matched = MULTIPLAYER_CAR_COLORS.find(
      c => c.main.toLowerCase() === multiplayerService.myColor.toLowerCase()
    );
    if (matched) {
      playerRef.current.color = matched.main;
      playerRef.current.colorDark = matched.dark;
      playerRef.current.accentColor = matched.accent;
    }

    multiplayerService.setCallbacks({
      onPeersUpdated: (peers) => {
        setPeerCount(peers.length);
        refreshMpLeaderboard();
      },
      onPeerLeave: (peerId) => {
        remotePlayerManagerRef.current.markDisconnected(peerId);
        refreshMpLeaderboard();
      },
      onRemotePlayerUpdate: (data) => {
        remotePlayerManagerRef.current.updateFromNetwork(data);
        refreshMpLeaderboard();
      },
      onNpcUpdate: (npcList) => {
        if (!multiplayerService.isHost) {
          const em = entityManagerRef.current;
          npcList.forEach((n) => {
            let local = em.entities.find((e) => e.id === n.id);
            if (!local) {
              local = new Entity(n.x, n.y, n.type);
              local.id = n.id;
              local.color = n.color;
              em.entities.push(local);
            }
            local.x = n.x;
            local.y = n.y;
            local.z = n.z;
            local.angle = n.angle;
            local.speed = n.speed;
            local.isHit = n.isHit;
          });
        }
      },
      onPlayerHit: (hitterId) => {
        if (hitterId !== multiplayerService.myId && !mpFinalResultsRef.current) {
          soundService.playHitSound('CAR');
          shakeTimerRef.current = 0.2;
        }
      },
    });

    refreshMpLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayerService]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (multiplayerService) {
        // Collect final standings and save to multiplayer score
        const localRacer: MpLeaderboardRacer = {
          id: multiplayerService.myId,
          name: multiplayerService.myName,
          score: scoreRef.current,
          color: multiplayerService.myColor,
          isLocal: true,
          isDisconnected: false,
        };
        const remotes: MpLeaderboardRacer[] = Array.from(
          remotePlayerManagerRef.current.players.values()
        ).map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          color: p.color,
          isLocal: false,
          isDisconnected: p.isDisconnected,
        }));
        const sorted = [localRacer, ...remotes].sort((a, b) => b.score - a.score);
        const myRank = sorted.findIndex((p) => p.isLocal) + 1;

        LocalStorageService.saveMultiplayerScore(scoreRef.current, myRank, sorted.length);
        const finalResults = { rank: myRank, racers: sorted };
        mpFinalResultsRef.current = finalResults;
        setMpFinalResults(finalResults);

        // 1. Freeze player car, clear target, reset inputs
        playerRef.current.speed = 0;
        playerRef.current.clearTarget();
        inputRef.current?.reset();

        // 2. Pause game loop
        isPausedRef.current = true;
        setIsPaused(true);

        // 3. Stop background music & engine audio nodes
        soundService.stopBackgroundMusic();
      } else {
        onGameOverRef.current(scoreRef.current);
      }
    }
  }, [timeLeft, multiplayerService]);

  const handleInteraction = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    playerRef.current.setPointerScreenX(clientX, canvas.width);
  };

  useEffect(() => {
    if (!inputRef.current) {
      inputRef.current = new InputManager();
    }

    const pauseGame = () => {
      // In multiplayer mode, NEVER pause! "no modo multiplayer não deveria ter pausa. Acaba o tempo, acabou."
      if (multiplayerService) return;
      if (isPausedRef.current) return;
      isPausedRef.current = true;
      setIsPaused(true);
      isPointerDownRef.current = false;
      playerRef.current.clearTarget();
      inputRef.current?.reset();
      soundService.pauseBackgroundMusic();
    };

    const resumeGame = () => {
      if (mpFinalResultsRef.current) return;
      if (multiplayerService) return;
      if (document.hidden || !isPausedRef.current) return;
      isPausedRef.current = false;
      setIsPaused(false);
      soundService.resumeBackgroundMusic();
    };

    const handleVisibilityChange = () => {
      // In multiplayer mode, NEVER pause on tab switch!
      if (multiplayerService) return;
      if (document.hidden) {
        pauseGame();
      } else {
        resumeGame();
      }
    };

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDownDismiss = (e: KeyboardEvent) => {
      if (mpFinalResultsRef.current) return;
      resumeGame();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        setShowControls(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownDismiss);

    const isHudTarget = (target: EventTarget | null) => {
      return target instanceof Element && Boolean(target.closest('.game-hud') || target.closest('.quit-btn') || target.closest('.mp-results-overlay'));
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (mpFinalResultsRef.current) return;
      resumeGame();
      if (isHudTarget(e.target)) return;
      isPointerDownRef.current = true;
      handleInteraction(e.clientX);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (mpFinalResultsRef.current) return;
      if (isPointerDownRef.current) {
        handleInteraction(e.clientX);
      }
    };

    const handleMouseUp = () => {
      isPointerDownRef.current = false;
      playerRef.current.clearTarget();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (mpFinalResultsRef.current) return;
      resumeGame();
      if (isHudTarget(e.target)) return;
      isPointerDownRef.current = true;
      if (e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (mpFinalResultsRef.current) return;
      if (isPointerDownRef.current && e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      isPointerDownRef.current = false;
      playerRef.current.clearTarget();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', pauseGame);
    window.addEventListener('focus', resumeGame);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    soundService.startBackgroundMusic();

    const startTime = Date.now();
    const timer = setInterval(() => {
      if (multiplayerService) {
        // Wall-clock calculation: immune to background tab throttling!
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 60 - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
        }
      } else {
        if (isPausedRef.current) return;
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    const controlsTimer = setTimeout(() => setShowControls(false), 4000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', pauseGame);
      window.removeEventListener('focus', resumeGame);
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
  }, [multiplayerService]);

  const getCameraParams = (H: number, player: PlayerCar, tileMap: TileMap) => {
    const camAngle = player.angle - player.steerVisual * 0.1;
    const cosCam = Math.cos(camAngle);
    const sinCam = Math.sin(camAngle);
    const baseCamDist = 82;
    let camDist = baseCamDist;
    for (let testDist = 20; testDist <= baseCamDist; testDist += 12) {
      const testX = player.x - cosCam * testDist;
      const testY = player.y - sinCam * testDist;
      if (tileMap.isColliding(testX, testY, 6)) {
        camDist = Math.max(24, testDist - 12);
        break;
      }
    }
    const camX = player.x - cosCam * camDist;
    const camY = player.y - sinCam * camDist;
    const camHeight = 52;
    const baseHorizonY = Math.floor(H * 0.38);
    // Lock focalLength so that (player.x, player.y) at depth baseCamDist projects directly onto the car sprite at y = H - 92
    const carContactY = H - 92;
    const focalLength = Math.max(320, ((carContactY - baseHorizonY) * baseCamDist) / camHeight);

    return { camAngle, cosCam, sinCam, camDist, camX, camY, camHeight, baseHorizonY, focalLength };
  };

  const update = (dt: number) => {
    if (isPausedRef.current || mpFinalResultsRef.current) return;
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

    // Wall (Building / Water) Hull Collision with tight 7px hull matching the 3D car body
    const hullRadius = 7;
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

    // Entity Collision: project entities with the exact 3D camera matrix so hits only trigger
    // when an obstacle visually touches the player car's bumper/fenders on screen!
    const canvas = canvasRef.current;
    const W = canvas ? canvas.width : window.innerWidth;
    const H = canvas ? canvas.height : window.innerHeight;
    const { camAngle, cosCam, sinCam, camX, camY, camHeight, baseHorizonY, focalLength } = getCameraParams(
      H,
      player,
      tileMap
    );

    const carScale = Math.max(0.85, Math.min(1.25, W / 900));
    const carScreenX = W * 0.5 + player.steerVisual * 26;
    const carBottomY = H - 78;
    // Visual bumper/fender footprint of the player's car on screen
    const carHalfW = 58 * carScale;
    const carFrontY = carBottomY - 36 * carScale;
    const carRearY = carBottomY + 6 * carScale;

    entityManager.update(dt, player.x, player.y, tileMap, player.angle);

    entityManager.entities.forEach(entity => {
      if (!entity.isAlive || entity.isHit) return;

      const dx = entity.x - camX;
      const dy = entity.y - camY;
      const tz = dx * cosCam + dy * sinCam;
      if (tz < 18 || tz > 130) return;

      const tx = -dx * sinCam + dy * cosCam;
      const entityScreenX = W * 0.5 + (tx / tz) * focalLength;
      const entityScreenY = baseHorizonY + (camHeight / tz) * focalLength;
      const s = Math.min(focalLength / tz, 10.5);
      const relAngle = entity.angle - (camAngle + Math.atan2(tx, tz) * 0.55);
      const sideAmt = Math.abs(Math.sin(relAngle));

      const entityVisualHalfW =
        entity.type === 'PERSON'
          ? 1.2 * s
          : entity.type === 'BIKE'
            ? (1.5 + sideAmt * 2.0) * s
            : entity.type === 'MOTORCYCLE'
              ? (2.1 + sideAmt * 2.3) * s
              : (5.5 + sideAmt * 2.8) * s;

      // Require both vertical road-contact overlap (front bumper to rear wheels) AND horizontal sprite overlap
      if (
        entityScreenY >= carFrontY &&
        entityScreenY <= carRearY &&
        Math.abs(entityScreenX - carScreenX) <= carHalfW + entityVisualHalfW
      ) {
        // Hit! Launch entity into 3D accident flight right from the front bumper
        setScore(prev => prev + entity.points);
        entity.triggerHit(player.x, player.y, player.angle, player.speed);
        soundService.playHitSound(entity.type);
        shakeTimerRef.current = entity.type === 'CAR' ? 0.22 : 0.1;

        if (canvas) {
          const sign = entity.points > 0 ? '+' : '';
          popupsRef.current.push({
            id: nextPopupIdRef.current++,
            text: `${sign}${entity.points} PTS`,
            color: entity.points > 0 ? '#00e5ff' : '#ff2a85',
            x: entityScreenX,
            y: carFrontY - 20,
            life: 0.85,
          });
        }

        // Speed penalty & slight deflection on hit for other cars
        if (entity.type === 'CAR') {
          player.speed *= 0.65;
          player.angle += (entityScreenX >= carScreenX ? -1 : 1) * 0.15;
        }
      }
    });

    // Update remote players and network synchronization
    remotePlayerManagerRef.current.update(dt);

    if (multiplayerService) {
      if (playerHitCooldownRef.current > 0) {
        playerHitCooldownRef.current -= dt;
      }

      // Check collision between local car and remote players
      const collidedPeer = remotePlayerManagerRef.current.checkCollisionWithPlayer(player.x, player.y, 24);
      if (collidedPeer && playerHitCooldownRef.current <= 0) {
        playerHitCooldownRef.current = 0.55;
        soundService.playHitSound('CAR');
        shakeTimerRef.current = 0.22;
        player.speed = -player.speed * 0.45;
        multiplayerService.sendHit(collidedPeer.id);

        popupsRef.current.push({
          id: nextPopupIdRef.current++,
          text: `BUMP: ${collidedPeer.name}!`,
          color: collidedPeer.color,
          x: W * 0.5,
          y: H - 120,
          life: 1.2,
        });
      }

      // 25 Hz local player state broadcast
      lastNetworkSendRef.current += dt;
      if (lastNetworkSendRef.current >= 0.04) {
        lastNetworkSendRef.current = 0;
        multiplayerService.sendPlayerUpdate({
          x: player.x,
          y: player.y,
          angle: player.angle,
          speed: player.speed,
          steerVisual: player.steerVisual,
          isBraking: player.isBraking,
          score: scoreRef.current,
        });
      }

      // 15 Hz Host NPC broadcast
      if (multiplayerService.isHost) {
        lastNpcSendRef.current += dt;
        if (lastNpcSendRef.current >= 0.065) {
          lastNpcSendRef.current = 0;
          multiplayerService.sendNpcUpdate(
            entityManager.entities.slice(0, 16).map(e => ({
              id: e.id,
              type: e.type,
              x: e.x,
              y: e.y,
              z: e.z,
              angle: e.angle,
              speed: e.speed,
              isHit: e.isHit,
              color: e.color,
            }))
          );
        }
      }
    }
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

    // 3D Camera parameters (shared with collision projection)
    const { camAngle, camX, camY, camHeight, baseHorizonY, focalLength } = getCameraParams(
      H,
      player,
      tileMap
    );

    const shakeX = shakeTimerRef.current > 0 ? (Math.random() - 0.5) * 10 : 0;
    const shakeY = shakeTimerRef.current > 0 ? (Math.random() - 0.5) * 10 : 0;
    const horizonY = baseHorizonY + Math.round(player.bounceOffset * 0.5) + shakeY;

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
    const remoteDrawables = remotePlayerManagerRef.current.getVisibleDrawables(
      camX,
      camY,
      camAngle,
      camHeight,
      horizonY,
      focalLength,
      W
    );

    const allDrawables = [...buildingDrawables, ...entityDrawables, ...remoteDrawables];
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

    // Remote player dots on radar minimap
    remotePlayerManagerRef.current.drawMinimap(ctx, mapX, mapY, scaleX, scaleY);

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

    // Update Top Gear 3000 HUD Tachometer, Gear & Speed via Refs (scaled to realistic city KM/H)
    const rawSpeed = Math.abs(player.speed);
    const displayKmh = Math.round(rawSpeed * 0.28); // ~98 KM/H at cruising maxSpeed (350), ~108 KM/H with boost
    const gearThresholds = [22, 45, 68, 90, 120];
    let gearIdx = 0;
    while (gearIdx < gearThresholds.length - 1 && displayKmh > gearThresholds[gearIdx]) {
      gearIdx++;
    }
    const gearNum = player.speed < -5 ? 'R' : (gearIdx + 1).toString();
    const prevThreshold = gearIdx === 0 ? 0 : gearThresholds[gearIdx - 1];
    const gearSpan = gearThresholds[gearIdx] - prevThreshold;
    const rpmPct =
      rawSpeed < 2
        ? 0
        : Math.min(100, Math.max(15, Math.round(((displayKmh - prevThreshold) / gearSpan) * 100)));

    if (speedTextRef.current) {
      speedTextRef.current.textContent = `${displayKmh.toString().padStart(3, '0')} KM/H`;
    }
    if (gearTextRef.current) {
      gearTextRef.current.textContent = `G${gearNum}`;
    }
    if (rpmFillRef.current) {
      rpmFillRef.current.style.width = `${rpmPct}%`;
    }
  };

  useGameLoop(update, draw, isPaused);

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

      {multiplayerService && (
        <>
          <div className="mp-hud-banner">
            <span className="mp-hud-title">ONLINE P2P</span>
            <span className="mp-hud-code">SALA: {multiplayerService.roomId}</span>
            <span className="mp-hud-peers">👥 {peerCount}</span>
          </div>

          <div className="mp-score-leaderboard">
            <div className="mp-leaderboard-header">PLACAR AO VIVO</div>
            <div className="mp-leaderboard-list">
              {liveMpScores.map((racer, idx) => (
                <div
                  key={racer.id}
                  className={`mp-leaderboard-row ${racer.isLocal ? 'is-local' : ''} ${racer.isDisconnected ? 'is-disconnected' : ''}`}
                >
                  <span className="mp-lb-rank">#{idx + 1}</span>
                  <span
                    className="mp-lb-color"
                    style={{ backgroundColor: racer.isDisconnected ? '#666666' : racer.color }}
                  />
                  <span className="mp-lb-name">
                    {racer.name}
                    {racer.isLocal ? ' (VOCÊ)' : racer.isDisconnected ? ' [OFF]' : ''}
                  </span>
                  <span className="mp-lb-score">{racer.score}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {mpFinalResults && (
        <div className="mp-results-overlay">
          <div className="mp-results-card">
            <h2 className="mp-results-title">FIM DA CORRIDA!</h2>
            <div className={`mp-results-badge ${mpFinalResults.rank === 1 ? 'gold' : ''}`}>
              {mpFinalResults.rank === 1 ? '🏆 1º LUGAR! CAMPEÃO!' : `🏁 ${mpFinalResults.rank}º LUGAR`}
            </div>
            <p className="mp-results-sub">PLACAR MULTIPLAYER &bull; SALA {multiplayerService?.roomId}</p>

            <table className="mp-final-table">
              <thead>
                <tr>
                  <th>POS</th>
                  <th>PILOTO</th>
                  <th>PONTOS</th>
                </tr>
              </thead>
              <tbody>
                {mpFinalResults.racers.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`${r.isLocal ? 'highlight-local' : ''} ${r.isDisconnected ? 'is-disconnected' : ''}`}
                  >
                    <td className="mp-rank-col">#{i + 1}</td>
                    <td className="mp-name-col">
                      <span
                        className="mp-lb-color"
                        style={{ backgroundColor: r.isDisconnected ? '#666666' : r.color }}
                      />
                      <span>
                        {r.name} {r.isLocal ? '(VOCÊ)' : r.isDisconnected ? '(DESCONECTADO)' : ''}
                      </span>
                    </td>
                    <td className="mp-score-col">{r.score} PTS</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className="mp-leave-btn"
              onClick={() => {
                soundService.playUiSound();
                if (multiplayerService) {
                  multiplayerService.leave();
                }
                if (onBackToMenu) {
                  onBackToMenu();
                } else {
                  onGameOver(score);
                }
              }}
            >
              VOLTAR AO MENU
            </button>
          </div>
        </div>
      )}

      <div className="game-hud bottom">
        <div className="hud-group">
          {multiplayerService ? (
            <div className="hud-item score mp-score-hud">
              <span className="mp-hud-rank-label">
                RANK #{Math.max(1, liveMpScores.findIndex((r) => r.isLocal) + 1)}
              </span>
              <span className="mp-hud-score-val">{score} PTS</span>
            </div>
          ) : (
            <div className="hud-item score">SCORE: {score}</div>
          )}
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
              if (multiplayerService) {
                multiplayerService.leave();
                if (onBackToMenu) {
                  onBackToMenu();
                  return;
                }
              }
              onGameOver(score);
            }}
          >
            {multiplayerService ? 'SAIR' : 'ABORT'}
          </button>
        </div>
      </div>
    </div>
  );
};
