import React, { useRef, useEffect, useState } from 'react';
import './GameCanvas.css';
import { useGameLoop } from './useGameLoop';
import { PlayerCar } from './PlayerCar';
import { InputManager } from './InputManager';
import { TileMap } from './TileMap';
import { EntityManager, Entity, ENTITY_SCALE } from './Entities';
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

interface ElementWithFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onGameOver,
  multiplayerService,
  onBackToMenu,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({
    width: Math.round(window.visualViewport?.width || window.innerWidth),
    height: Math.round(window.visualViewport?.height || window.innerHeight),
  });
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // 1 minute in seconds
  const [showControls, setShowControls] = useState(() => !multiplayerService);
  const [isPaused, setIsPaused] = useState(() => (multiplayerService ? false : document.hidden));
  const [peerCount, setPeerCount] = useState(() => (multiplayerService ? multiplayerService.getConnectedPeers().length : 1));
  const pingBadgeRef = useRef<HTMLSpanElement>(null);
  const [mpFinalResults, setMpFinalResults] = useState<{ rank: number; racers: MpLeaderboardRacer[] } | null>(null);
  const mpFinalResultsRef = useRef<{ rank: number; racers: MpLeaderboardRacer[] } | null>(null);
  const [liveMpScores, setLiveMpScores] = useState<MpLeaderboardRacer[]>([]);
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundService.isMuted());

  const handleToggleMute = () => {
    const nextMuted = soundService.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      soundService.playUiSound();
    }
  };

  const handleToggleOrientation = async () => {
    soundService.playUiSound();
    try {
      if (!document.fullscreenElement) {
        const root = document.documentElement as ElementWithFullscreen;
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      }
      if ('orientation' in screen && screen.orientation && 'lock' in screen.orientation) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Ignored if unsupported
    }
    if (window.innerHeight > window.innerWidth) {
      setShowRotatePrompt(prev => !prev);
    }
  };

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
  const comboCountRef = useRef(0);
  const comboTimerRef = useRef(0);

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

    // In multiplayer mode: obstacles NEVER respawn; population strictly decreases on collisions
    entityManagerRef.current.allowRespawn = false;
    if (multiplayerService.isHost) {
      entityManagerRef.current.initMultiplayer(40, tileMapRef.current);
    } else {
      entityManagerRef.current.entities = [];
    }

    // Apply player's unique randomized spawn point and start grace period
    const spawn = getPlayerSpawnPoint(
      multiplayerService.getMySpawnIndex(),
      multiplayerService.getSpawnSeed()
    );
    playerRef.current.x = spawn.x;
    playerRef.current.y = spawn.y;
    playerRef.current.angle = spawn.angle;
    playerHitCooldownRef.current = 2.5;

    // Apply player's unique auto-selected car palette
    const playerColor = multiplayerService.getMyColor();
    const matched = MULTIPLAYER_CAR_COLORS.find(
      c => c.main.toLowerCase() === playerColor.toLowerCase()
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
        const prev = remotePlayerManagerRef.current.players.get(data.id);
        const shouldRefresh = !prev || prev.isDisconnected || prev.score !== data.score;
        remotePlayerManagerRef.current.updateFromNetwork(data);
        if (shouldRefresh) {
          refreshMpLeaderboard();
        }
      },
      onNpcUpdate: (npcList) => {
        if (!multiplayerService.isHost) {
          const em = entityManagerRef.current;
          const remoteIds = new Set(npcList.map((n) => n.id));

          npcList.forEach((n) => {
            let local = em.entities.find((e) => e.id === n.id);
            if (!local) {
              local = new Entity(n.x, n.y, n.type);
              local.id = n.id;
              local.setCarColor(n.color);
              em.entities.push(local);
            }
            local.x = n.x;
            local.y = n.y;
            local.z = n.z;
            local.angle = n.angle;
            local.speed = n.speed;
            local.isHit = n.isHit;
          });

          // In multiplayer, clean up entities that the host already despawned/destroyed
          em.entities = em.entities.filter((e) => remoteIds.has(e.id) || e.isHit);
        }
      },
      onPlayerHit: (hitterId, targetId) => {
        const isTargetMe = targetId ? targetId === multiplayerService.myId : hitterId !== multiplayerService.myId;
        if (isTargetMe && hitterId !== multiplayerService.myId && !mpFinalResultsRef.current) {
          soundService.playHitSound('CAR');
          shakeTimerRef.current = 0.2;
          playerRef.current.speed *= 0.65;
        }
      },
      onNpcHit: (npcId, hitterId, hitParams) => {
        if (hitterId !== multiplayerService.myId) {
          const target = entityManagerRef.current.entities.find((e) => e.id === npcId);
          if (target && !target.isHit) {
            target.triggerHit(
              hitParams?.x ?? target.x,
              hitParams?.y ?? target.y,
              hitParams?.angle ?? 0,
              hitParams?.speed ?? 120
            );
            soundService.playHitSound(target.type);
          }
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

    const getViewportSize = () => {
      const el = containerRef.current;
      const width =
        el && el.clientWidth > 0
          ? el.clientWidth
          : Math.round(window.visualViewport?.width || window.innerWidth);
      const height =
        el && el.clientHeight > 0
          ? el.clientHeight
          : Math.round(window.visualViewport?.height || window.innerHeight);
      return { width, height };
    };

    const handleResize = () => {
      const next = getViewportSize();
      setDimensions((prev) =>
        prev.width === next.width && prev.height === next.height ? prev : next
      );
      if (next.width >= next.height) {
        setShowRotatePrompt(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    const handleOrientationChange = () => {
      handleResize();
      setTimeout(handleResize, 100);
      setTimeout(handleResize, 300);
      setTimeout(handleResize, 600);
    };
    window.addEventListener('orientationchange', handleOrientationChange);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    const handleKeyDownDismiss = (e: KeyboardEvent) => {
      if (mpFinalResultsRef.current) return;
      resumeGame();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        setShowControls(false);
      }
    };
    window.addEventListener('keydown', handleKeyDownDismiss);

    const isHudTarget = (target: EventTarget | null) => {
      return target instanceof Element && Boolean(
        target.closest('.game-hud') ||
        target.closest('.quit-btn') ||
        target.closest('.mute-btn') ||
        target.closest('.orientation-btn') ||
        target.closest('.rotate-prompt-overlay') ||
        target.closest('.mp-results-overlay')
      );
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

    const syncTouchBrake = (touches: TouchList) => {
      const isTwoFingerBrake = touches.length >= 2;
      inputRef.current?.setManualInput({
        forward: false,
        backward: isTwoFingerBrake,
        left: false,
        right: false,
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (mpFinalResultsRef.current) return;
      resumeGame();
      if (isHudTarget(e.target)) return;
      isPointerDownRef.current = true;
      syncTouchBrake(e.touches);
      if (e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (mpFinalResultsRef.current) return;
      syncTouchBrake(e.touches);
      if (isPointerDownRef.current && e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      syncTouchBrake(e.touches);
      if (e.touches.length === 0) {
        isPointerDownRef.current = false;
        playerRef.current.clearTarget();
      } else if (e.touches[0]) {
        handleInteraction(e.touches[0].clientX);
      }
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

    let pingInterval: ReturnType<typeof setInterval> | null = null;
    if (multiplayerService) {
      const updatePing = async () => {
        const ms = await multiplayerService.getPing();
        if (pingBadgeRef.current) {
          const quality = ms === null ? '' : ms < 80 ? 'good' : ms < 160 ? 'medium' : 'poor';
          pingBadgeRef.current.className = `mp-hud-ping ${quality}`.trim();
          pingBadgeRef.current.textContent = `📶 ${ms !== null ? `${ms}ms` : '--'}`;
        }
      };
      void updatePing();
      pingInterval = setInterval(updatePing, 2000);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', pauseGame);
      window.removeEventListener('focus', resumeGame);
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      window.removeEventListener('keydown', handleKeyDownDismiss);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      clearInterval(timer);
      if (pingInterval) clearInterval(pingInterval);
      clearTimeout(controlsTimer);
      soundService.stopBackgroundMusic();
      if (inputRef.current) {
        inputRef.current.destroy();
        inputRef.current = null;
      }
    };
  }, [multiplayerService]);

  /**
   * 🔒 REGRA ESTRITA DE DESIGN (CAMERA & PROJECTION FREEZE - NÃO ALTERAR):
   * Parâmetros de projeção 3D (camHeight = 52, baseCamDist = 82, focalLength,
   * carContactY e baseHorizonY) estão congelados e aprovados para manter
   * proporções idênticas em Desktop, Mobile Retrato e Mobile Horizontal.
   */
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
    const isLandscapeMobile = H < 520;
    const baseHorizonY = Math.floor(H * (isLandscapeMobile ? 0.35 : 0.38));
    // Lock focalLength so that ground contact at baseCamDist projects smoothly onto the player car contact line
    const carContactY = isLandscapeMobile ? H - 64 : H - 92;
    const focalLength = Math.max(
      isLandscapeMobile ? 420 : 320,
      ((carContactY - baseHorizonY) * baseCamDist) / camHeight
    );

    return { camAngle, cosCam, sinCam, camDist, camX, camY, camHeight, baseHorizonY, focalLength, isLandscapeMobile };
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

    // Shallow water drag: allow driving through water at reduced speed (~45% maxSpeed)
    if (tileMap.isWater(player.x, player.y)) {
      const maxWaterSpeed = player.maxSpeed * 0.45;
      player.speed *= Math.pow(0.25, dt);
      if (player.speed > maxWaterSpeed) {
        player.speed = maxWaterSpeed;
      } else if (player.speed < -maxWaterSpeed * 0.6) {
        player.speed = -maxWaterSpeed * 0.6;
      }
    }

    // Update continuous Top Gear 3000 engine sound & 5-speed transmission pitch
    soundService.updateEngineSound(player.speed, player.steerVisual, player.isBraking);

    // Building Wall Hull Collision with tight 7px hull matching the 3D car body
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

    // Update screen shake timer, combo decay & floating score popups
    if (shakeTimerRef.current > 0) {
      shakeTimerRef.current = Math.max(0, shakeTimerRef.current - dt);
    }

    if (comboTimerRef.current > 0) {
      comboTimerRef.current = Math.max(0, comboTimerRef.current - dt);
      if (comboTimerRef.current === 0) {
        comboCountRef.current = 0;
      }
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
    const { camAngle, cosCam, sinCam, camX, camY, camHeight, baseHorizonY, focalLength, isLandscapeMobile } = getCameraParams(
      H,
      player,
      tileMap
    );

    const { scale: carScale } = player.getVisualDimensions(W, H);
    const carScreenX = W * 0.5 + player.steerVisual * 26;
    const carBottomY = isLandscapeMobile ? H - 52 : H - 78;
    // Visual bumper/fender footprint of the player's car on screen
    const carHalfW = 58 * carScale;
    const carFrontY = carBottomY - (isLandscapeMobile ? 42 : 36) * carScale;
    const carRearY = carBottomY + (isLandscapeMobile ? 18 : 6) * carScale;

    entityManager.update(dt, player.x, player.y, tileMap, player.angle);

    entityManager.entities.forEach(entity => {
      if (!entity.isAlive || entity.isHit) return;

      const dx = entity.x - camX;
      const dy = entity.y - camY;
      const tz = dx * cosCam + dy * sinCam;
      if (tz < 18 || tz > 260) return;

      const tx = -dx * sinCam + dy * cosCam;
      const entityScreenX = W * 0.5 + (tx / tz) * focalLength;
      const entityScreenY = baseHorizonY + (camHeight / tz) * focalLength;
      const s = Math.min((focalLength / Math.max(tz, 76)) * ENTITY_SCALE, 48);
      const relAngle = entity.angle - (camAngle + Math.atan2(tx, tz) * 0.55);
      const sideAmt = Math.abs(Math.sin(relAngle));

      const entityVisualHalfW =
        entity.type === 'PERSON'
          ? 1.4 * s
          : entity.type === 'BIKE'
            ? (1.7 + sideAmt * 2.2) * s
            : entity.type === 'MOTORCYCLE'
              ? (2.4 + sideAmt * 2.5) * s
              : (5.8 + sideAmt * 1.2) * s;

      // Require both vertical road-contact overlap (front bumper to rear wheels) AND horizontal sprite overlap
      if (
        entityScreenY >= carFrontY &&
        entityScreenY <= carRearY &&
        Math.abs(entityScreenX - carScreenX) <= carHalfW + entityVisualHalfW
      ) {
        // Hit! Launch entity into 3D accident flight right from the front bumper
        let totalPoints = entity.points;
        let popupText = `${entity.points > 0 ? '+' : ''}${entity.points} PTS`;
        if (entity.points > 0) {
          comboCountRef.current += 1;
          comboTimerRef.current = 2.5;
          if (comboCountRef.current >= 2) {
            const comboBonus = Math.min(3, comboCountRef.current - 1);
            totalPoints += comboBonus;
            popupText = `+${totalPoints} PTS (x${comboCountRef.current})`;
          }
        } else if (entity.type === 'CAR') {
          comboCountRef.current = 0;
          comboTimerRef.current = 0;
        }

        setScore(prev => prev + totalPoints);
        entity.triggerHit(player.x, player.y, player.angle, player.speed);
        soundService.playHitSound(entity.type);
        shakeTimerRef.current = entity.type === 'CAR' ? 0.22 : 0.1;

        if (multiplayerService) {
          multiplayerService.sendNpcHit(entity.id, player.x, player.y, player.angle, player.speed);
        }

        if (canvas) {
          popupsRef.current.push({
            id: nextPopupIdRef.current++,
            text: popupText,
            color: entity.points > 0 ? (comboCountRef.current >= 2 ? '#ffbe0b' : '#00e5ff') : '#ff2a85',
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

        // Crash into another player: award +20 points in multiplayer
        setScore(prev => prev + 20);

        popupsRef.current.push({
          id: nextPopupIdRef.current++,
          text: `+20 PTS: ${collidedPeer.name}!`,
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
            entityManager.entities
              .filter(e => e.isAlive)
              .map(e => ({
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
    const isSmallScreen = H < 520;
    const mapW = isSmallScreen ? 95 : 150;
    const mapH = isSmallScreen ? 95 : 150;
    const mapX = W - mapW - (isSmallScreen ? 12 : 20);
    const mapY = isSmallScreen ? 12 : 20;

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
    const coneLen = isSmallScreen ? 20 : 30;
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
    <div ref={containerRef} className="game-view-container">
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
            <p><strong>W / UP</strong> NITRO BOOST &bull; <strong>S / DOWN / 2-FINGER TOUCH</strong> BRAKE / REV</p>

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
            <span
              ref={pingBadgeRef}
              className="mp-hud-ping"
              title="Latência da conexão P2P (Round-Trip Time)"
            >
              📶 --
            </span>
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

      {showRotatePrompt && dimensions.height > dimensions.width && (
        <div className="rotate-prompt-overlay" onClick={() => setShowRotatePrompt(false)}>
          <div className="rotate-prompt-card" onClick={(e) => e.stopPropagation()}>
            <div className="rotate-icon-anim">📱 ➔ 📲</div>
            <h3>MODO HORIZONTAL</h3>
            <p>Gire o seu celular para a posição horizontal (paisagem) para a melhor experiência!</p>
            <button
              className="rotate-confirm-btn"
              onClick={() => setShowRotatePrompt(false)}
            >
              ENTENDI 👍
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
          <div className="hud-actions-row">
            <button
              className="mute-btn"
              title="Alternar Áudio"
              aria-label="Alternar Áudio"
              onClick={handleToggleMute}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button
              className="orientation-btn"
              title="Alternar Orientação Horizontal"
              aria-label="Alternar Orientação Horizontal"
              onClick={handleToggleOrientation}
            >
              🔄
            </button>
            <button
              className="quit-btn"
              onClick={() => {
                soundService.playUiSound();
                if (multiplayerService) {
                  multiplayerService.leave();
                }
                if (onBackToMenu) {
                  onBackToMenu();
                  return;
                }
                onGameOver(score);
              }}
            >
              {multiplayerService ? 'SAIR' : 'ABORT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
