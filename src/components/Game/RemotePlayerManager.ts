import { Entity } from './Entities';
import type { Drawable3D } from './Entities';
import type { PlayerNetworkData } from '../../services/MultiplayerService';
import { MULTIPLAYER_CAR_COLORS } from '../../services/MultiplayerService';

export interface RemotePlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  targetAngle: number;
  speed: number;
  steerVisual: number;
  score: number;
  lastUpdate: number;
  entity: Entity;
}

export class RemotePlayerManager {
  public players: Map<string, RemotePlayer> = new Map();

  updateFromNetwork(data: PlayerNetworkData) {
    let p = this.players.get(data.id);
    if (!p) {
      // Find matching palette or create custom
      const matched = MULTIPLAYER_CAR_COLORS.find(c => c.main.toLowerCase() === data.color.toLowerCase()) || {
        name: 'Custom',
        main: data.color || '#3a86ff',
        dark: '#023e8a',
        accent: '#00b4d8',
      };

      const entity = new Entity(data.x, data.y, 'CAR');
      entity.speed = data.speed;
      entity.angle = data.angle;
      entity.palette = {
        body: matched.main,
        bodyDark: matched.dark,
        cabin: matched.dark,
        accent: matched.accent,
      };

      p = {
        id: data.id,
        name: data.name || 'Rival',
        color: data.color,
        x: data.x,
        y: data.y,
        targetX: data.x,
        targetY: data.y,
        angle: data.angle,
        targetAngle: data.angle,
        speed: data.speed,
        steerVisual: data.steerVisual,
        score: data.score,
        lastUpdate: Date.now(),
        entity,
      };
      this.players.set(data.id, p);
    } else {
      p.targetX = data.x;
      p.targetY = data.y;
      p.targetAngle = data.angle;
      p.speed = data.speed;
      p.steerVisual = data.steerVisual;
      p.score = data.score;
      p.lastUpdate = Date.now();
      p.name = data.name || p.name;
    }
  }

  removePlayer(id: string) {
    this.players.delete(id);
  }

  update(dt: number) {
    const now = Date.now();
    for (const [id, p] of this.players.entries()) {
      // Remove inactive peers after 8 seconds
      if (now - p.lastUpdate > 8000) {
        this.players.delete(id);
        continue;
      }

      // Smooth dead-reckoning / interpolation (lerp)
      const lerpSpeed = Math.min(1, dt * 14);
      p.x += (p.targetX - p.x) * lerpSpeed;
      p.y += (p.targetY - p.y) * lerpSpeed;

      // Angle shortest-arc interpolation
      let angleDiff = p.targetAngle - p.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      p.angle += angleDiff * lerpSpeed;

      // Keep underlying 3D entity position & heading in sync
      p.entity.x = p.x;
      p.entity.y = p.y;
      p.entity.angle = p.angle;
      p.entity.speed = p.speed;
    }
  }

  getVisibleDrawables(
    camX: number,
    camY: number,
    camAngle: number,
    camHeight: number,
    horizonY: number,
    focalLength: number,
    canvasWidth: number
  ): Drawable3D[] {
    const drawables: Drawable3D[] = [];
    const cosA = Math.cos(camAngle);
    const sinA = Math.sin(camAngle);
    const centerX = canvasWidth * 0.5;

    for (const p of this.players.values()) {
      const dx = p.x - camX;
      const dy = p.y - camY;
      const tz = dx * cosA + dy * sinA;
      if (tz < 12 || tz > 1350) continue;

      const tx = -dx * sinA + dy * cosA;
      const screenX = centerX + (tx / tz) * focalLength;
      if (screenX < -120 || screenX > canvasWidth + 120) continue;

      const screenY = horizonY + (camHeight / tz) * focalLength;
      const s = Math.min(22, focalLength / tz);
      const depth = Math.hypot(dx, dy);

      drawables.push({
        depth,
        draw: (ctx: CanvasRenderingContext2D) => {
          // 1. Draw 3D Car sprite
          p.entity.draw3D(ctx, screenX, screenY, s, p.angle - camAngle);

          // 2. Draw Floating Name Tag & Crown above car
          ctx.save();
          const tagY = screenY - 8.5 * s;
          const fontSize = Math.max(9, Math.min(13, s * 0.9));
          ctx.font = `bold ${Math.round(fontSize)}px "Press Start 2P", monospace`;
          ctx.textAlign = 'center';

          // Background tag pill
          const tagText = p.name;
          const textW = ctx.measureText ? ctx.measureText(tagText).width : tagText.length * 8;
          ctx.fillStyle = 'rgba(9, 5, 29, 0.75)';
          ctx.fillRect(screenX - textW * 0.5 - 6, tagY - fontSize - 3, textW + 12, fontSize + 6);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(screenX - textW * 0.5 - 6, tagY - fontSize - 3, textW + 12, fontSize + 6);

          // Name text with glow
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tagText, screenX, tagY);
          ctx.restore();
        },
      });
    }

    return drawables;
  }

  checkCollisionWithPlayer(
    px: number,
    py: number,
    collisionRadius: number = 24
  ): RemotePlayer | null {
    for (const p of this.players.values()) {
      const dist = Math.hypot(p.x - px, p.y - py);
      if (dist < collisionRadius) {
        return p;
      }
    }
    return null;
  }

  drawMinimap(
    ctx: CanvasRenderingContext2D,
    mapX: number,
    mapY: number,
    scaleX: number,
    scaleY: number
  ) {
    for (const p of this.players.values()) {
      const mx = mapX + p.x * scaleX;
      const my = mapY + p.y * scaleY;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
