import { Entity, ENTITY_SCALE } from './Entities';
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
  isDisconnected: boolean;
}

export class RemotePlayerManager {
  public players: Map<string, RemotePlayer> = new Map();

  private resolvePalette(color: string) {
    const matched = MULTIPLAYER_CAR_COLORS.find(
      (c) => c.main.toLowerCase() === color.toLowerCase()
    );
    if (matched) {
      return {
        body: matched.main,
        bodyDark: matched.dark,
        cabin: matched.dark,
        accent: matched.accent,
      };
    }
    return {
      body: color || '#3a86ff',
      bodyDark: '#023e8a',
      cabin: '#023e8a',
      accent: '#00b4d8',
    };
  }

  updateFromNetwork(data: PlayerNetworkData) {
    let p = this.players.get(data.id);

    // If not found by id, check if a player with this name previously disconnected (reconnection)
    if (!p) {
      for (const existing of this.players.values()) {
        if (existing.isDisconnected && existing.name.toLowerCase() === data.name.toLowerCase()) {
          this.players.delete(existing.id);
          existing.id = data.id;
          p = existing;
          this.players.set(data.id, p);
          break;
        }
      }
    }

    if (!p) {
      const entity = new Entity(data.x, data.y, 'CAR');
      entity.speed = data.speed;
      entity.angle = data.angle;
      entity.palette = this.resolvePalette(data.color);

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
        isDisconnected: false,
      };
      this.players.set(data.id, p);
    } else {
      // Player is active / reconnected!
      p.isDisconnected = false;
      p.targetX = data.x;
      p.targetY = data.y;
      p.targetAngle = data.angle;
      p.speed = data.speed;
      p.steerVisual = data.steerVisual;
      p.score = Math.max(p.score, data.score);
      p.lastUpdate = Date.now();
      p.name = data.name || p.name;
      if (data.color && data.color.toLowerCase() !== p.color.toLowerCase()) {
        p.color = data.color;
        p.entity.palette = this.resolvePalette(data.color);
      }
    }
  }

  markDisconnected(id: string) {
    const p = this.players.get(id);
    if (p) {
      p.isDisconnected = true;
      p.speed = 0;
      p.targetX = p.x;
      p.targetY = p.y;
    }
  }

  removePlayer(id: string) {
    this.players.delete(id);
  }

  update(dt: number) {
    const now = Date.now();
    for (const p of this.players.values()) {
      // If inactive for > 5 seconds, freeze car and mark disconnected (keep score frozen permanently!)
      if (now - p.lastUpdate > 5000) {
        p.isDisconnected = true;
        p.speed = 0;
      }

      if (p.isDisconnected) {
        p.speed = 0;
        p.entity.speed = 0;
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
      const s = Math.min(28, focalLength / Math.max(tz, 76));
      const rayAngle = Math.atan2(tx, tz);
      const relAngle = p.angle - (camAngle + rayAngle * 0.55);
      const depth = Math.hypot(dx, dy);

      drawables.push({
        depth,
        draw: (ctx: CanvasRenderingContext2D) => {
          // 1. Draw 3D Car sprite
          p.entity.draw3D(ctx, screenX, screenY, s, relAngle);

          // 2. Draw Floating Name Tag & Crown above car
          ctx.save();
          const tagY = screenY - 6.8 * s * ENTITY_SCALE;
          const fontSize = Math.max(9, Math.min(13, s * 0.9));
          ctx.font = `bold ${Math.round(fontSize)}px "Press Start 2P", monospace`;
          ctx.textAlign = 'center';

          // Background tag pill
          const tagText = p.isDisconnected ? `${p.name} [OFF]` : p.name;
          const textW = ctx.measureText ? ctx.measureText(tagText).width : tagText.length * 8;
          ctx.fillStyle = p.isDisconnected ? 'rgba(30, 30, 40, 0.85)' : 'rgba(9, 5, 29, 0.75)';
          ctx.fillRect(screenX - textW * 0.5 - 6, tagY - fontSize - 3, textW + 12, fontSize + 6);
          ctx.strokeStyle = p.isDisconnected ? '#777777' : p.color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(screenX - textW * 0.5 - 6, tagY - fontSize - 3, textW + 12, fontSize + 6);

          // Name text with glow
          ctx.fillStyle = p.isDisconnected ? '#999999' : '#ffffff';
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
      if (p.isDisconnected) continue;
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

      ctx.fillStyle = p.isDisconnected ? '#666666' : p.color;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.isDisconnected ? '#444444' : '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
