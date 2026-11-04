import type { Drawable3D } from './TileMap';

export type EntityType = 'PERSON' | 'BIKE' | 'MOTORCYCLE' | 'CAR';

export class Entity {
  x: number;
  y: number;
  type: EntityType;
  width: number;
  height: number;
  angle: number;
  speed: number;
  points: number;
  color: string;
  isAlive: boolean = true;
  walkPhase: number = 0; // For person animation

  constructor(x: number, y: number, type: EntityType) {
    this.x = x;
    this.y = y;
    this.type = type;
    // Align mostly with city grid directions (0, PI/2, PI, 3PI/2) with slight variation
    const cardinal = Math.floor(Math.random() * 4) * (Math.PI / 2);
    this.angle = cardinal + (Math.random() - 0.5) * 0.25;
    this.speed = 50 + Math.random() * 50;
    this.walkPhase = Math.random() * Math.PI * 2;

    switch (type) {
      case 'PERSON':
        this.width = 14;
        this.height = 14;
        this.points = 1;
        this.color = '#FF9F43'; // Vibrant Orange
        this.speed = 35;
        break;
      case 'BIKE':
        this.width = 20;
        this.height = 20;
        this.points = 2;
        this.color = '#54A0FF'; // Bright Sky Blue
        this.speed = 70;
        break;
      case 'MOTORCYCLE':
        this.width = 26;
        this.height = 26;
        this.points = 5;
        this.color = '#5F27CD'; // Deep Purple
        this.speed = 115;
        break;
      case 'CAR':
        this.width = 44;
        this.height = 26;
        this.points = -5;
        this.color = '#EE5253'; // Intense Red
        this.speed = 130;
        break;
    }
  }

  update(dt: number, tileMap?: { isColliding: (x: number, y: number) => boolean, rows: number, cols: number, tileSize: number }) {
    const oldX = this.x;
    const oldY = this.y;

    // Simple movement along angle
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Boundary Check - Despawn if out of map
    if (tileMap) {
      const mapW = tileMap.cols * tileMap.tileSize;
      const mapH = tileMap.rows * tileMap.tileSize;
      if (this.x < 0 || this.x > mapW || this.y < 0 || this.y > mapH) {
        this.isAlive = false;
        return;
      }

      // Building/Water Collision for NPCs
      if (tileMap.isColliding(this.x, this.y)) {
        this.x = oldX;
        this.y = oldY;
        // Turn 90 or 180 degrees along street grid
        this.angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
      }
    }

    // Small chance to turn at intersections
    if (Math.random() < 0.008) {
      this.angle += (Math.random() - 0.5) * 0.6;
    }

    // Update walk animation phase
    this.walkPhase += dt * 10;
  }

  /**
   * Renders the entity in 3D behind-the-car perspective anchored at its ground shadow (screenX, screenY).
   */
  draw3D(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    scale: number,
    relAngle: number
  ) {
    // Clamp extreme near-camera scale so sprites don't fill the whole screen on impact
    const s = Math.min(scale, 14);
    if (s < 0.12) return;

    ctx.save();
    ctx.translate(screenX, screenY);

    const side = Math.sin(relAngle); // -1 (moving left) to +1 (moving right)
    const away = Math.cos(relAngle); // +1 (moving away) to -1 (oncoming)

    if (this.type === 'PERSON') {
      const spriteW = 10 * s;
      const spriteH = 22 * s;
      const swing = Math.sin(this.walkPhase) * 2.5 * s;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, spriteW * 0.65, Math.max(1.5, 2.5 * s), 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs (Blue pants)
      ctx.fillStyle = '#341f97';
      ctx.fillRect(-spriteW * 0.35, -spriteH * 0.38 + swing * 0.5, spriteW * 0.28, spriteH * 0.38);
      ctx.fillRect(spriteW * 0.07, -spriteH * 0.38 - swing * 0.5, spriteW * 0.28, spriteH * 0.38);

      // Torso (Vibrant Orange shirt)
      ctx.fillStyle = this.color;
      ctx.fillRect(-spriteW * 0.45, -spriteH * 0.75, spriteW * 0.9, spriteH * 0.4);

      // Arms
      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(-spriteW * 0.65, -spriteH * 0.72 - swing * 0.4, spriteW * 0.2, spriteH * 0.3);
      ctx.fillRect(spriteW * 0.45, -spriteH * 0.72 + swing * 0.4, spriteW * 0.2, spriteH * 0.3);

      // Head
      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(-spriteW * 0.3, -spriteH * 0.98, spriteW * 0.6, spriteH * 0.23);

      // Cap / Hair
      ctx.fillStyle = '#222';
      ctx.fillRect(-spriteW * 0.32, -spriteH, spriteW * 0.64, spriteH * 0.1);
    } else if (this.type === 'BIKE') {
      const bikeW = (10 + Math.abs(side) * 12) * s;
      const bikeH = 22 * s;
      const sideShift = side * 5 * s;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, bikeW * 0.65, Math.max(2, 3 * s), 0, 0, Math.PI * 2);
      ctx.fill();

      // Rear & front wheels
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(-sideShift - 2 * s, -9 * s, 4 * s, 9 * s);
      ctx.fillRect(sideShift - 2 * s, -9 * s, 4 * s, 9 * s);

      // Sky-blue frame
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1.5, 2.5 * s);
      ctx.beginPath();
      ctx.moveTo(-sideShift, -4.5 * s);
      ctx.lineTo(0, -13 * s);
      ctx.lineTo(sideShift, -4.5 * s);
      ctx.stroke();

      // Handlebars
      ctx.fillStyle = '#dfe6e9';
      ctx.fillRect(sideShift - 4.5 * s, -15 * s, 9 * s, 2 * s);

      // Rider body
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(-4 * s, -18 * s, 8 * s, 8 * s);

      // Rider helmet
      ctx.fillStyle = this.color;
      ctx.fillRect(-3 * s, -bikeH, 6 * s, 4.5 * s);
    } else if (this.type === 'MOTORCYCLE') {
      const motoW = (14 + Math.abs(side) * 14) * s;
      const sideShift = side * 6 * s;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, motoW * 0.65, Math.max(2, 3.5 * s), 0, 0, Math.PI * 2);
      ctx.fill();

      // Chunky tires
      ctx.fillStyle = '#111';
      ctx.fillRect(-sideShift - 3.5 * s, -11 * s, 7 * s, 11 * s);
      ctx.fillRect(sideShift - 3 * s, -11 * s, 6 * s, 11 * s);

      // Chrome exhaust pipe
      ctx.fillStyle = '#b2bec3';
      ctx.fillRect(-sideShift + 2.5 * s, -6 * s, 5 * s, 2.5 * s);

      // Deep Purple sport fairing
      ctx.fillStyle = this.color;
      ctx.fillRect(-motoW * 0.4, -15 * s, motoW * 0.8, 8 * s);

      // Rider in dark leather jacket
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(-5 * s, -22 * s, 10 * s, 8 * s);

      // White helmet
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3.8 * s, -27 * s, 7.6 * s, 5.5 * s);

      // Taillight (if moving away) or Headlight (if oncoming)
      ctx.fillStyle = away >= 0 ? '#ff3838' : '#fff200';
      ctx.fillRect(-sideShift - 2 * s, -13 * s, 4 * s, 3 * s);
    } else if (this.type === 'CAR') {
      const carW = (30 + Math.abs(side) * 14) * s;
      const carH = 24 * s;
      const yawShift = side * 7 * s;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(-carW * 0.52, -3 * s, carW * 1.04, 5 * s);

      // Tires
      ctx.fillStyle = '#111';
      ctx.fillRect(-carW * 0.46, -7 * s, carW * 0.18, 7 * s);
      ctx.fillRect(carW * 0.28, -7 * s, carW * 0.18, 7 * s);

      // Lower chassis body (Intense Red)
      ctx.fillStyle = this.color;
      ctx.fillRect(-carW * 0.5, -carH * 0.58, carW, carH * 0.42);

      // Darker side/lower trim
      ctx.fillStyle = '#b33939';
      ctx.fillRect(-carW * 0.5, -carH * 0.25, carW, carH * 0.1);

      // Upper cabin / roof (shifted slightly by yaw angle)
      ctx.fillStyle = '#d63031';
      ctx.fillRect(-carW * 0.36 + yawShift * 0.35, -carH * 0.96, carW * 0.72, carH * 0.4);

      // Windshield / Rear Window
      ctx.fillStyle = '#1e272e';
      ctx.fillRect(-carW * 0.3 + yawShift * 0.25, -carH * 0.9, carW * 0.6, carH * 0.28);

      // Lights: red taillights if facing away, bright yellow headlights if facing camera
      ctx.fillStyle = away >= 0 ? '#ff4d4d' : '#ffffaa';
      ctx.fillRect(-carW * 0.44, -carH * 0.48, carW * 0.18, carH * 0.14);
      ctx.fillRect(carW * 0.26, -carH * 0.48, carW * 0.18, carH * 0.14);

      // Bumper
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(-carW * 0.48, -carH * 0.22, carW * 0.96, carH * 0.08);
    }

    ctx.restore();
  }
}

export class EntityManager {
  entities: Entity[] = [];
  maxEntities: number = 65;
  spawnRange: number = 950; // Relative to player

  update(
    dt: number,
    playerX: number,
    playerY: number,
    tileMap?: { isColliding: (x: number, y: number) => boolean; rows: number; cols: number; tileSize: number },
    playerAngle: number = 0
  ) {
    // Remove far away or dead entities
    this.entities = this.entities.filter(e => {
      const dist = Math.hypot(e.x - playerX, e.y - playerY);
      return e.isAlive && dist < this.spawnRange + 250;
    });

    // Spawn new entities if needed
    while (this.entities.length < this.maxEntities) {
      this.spawnEntity(playerX, playerY, tileMap, playerAngle);
    }

    this.entities.forEach(e => e.update(dt, tileMap));
  }

  spawnEntity(
    playerX: number,
    playerY: number,
    tileMap?: { isColliding: (x: number, y: number) => boolean; rows: number; cols: number; tileSize: number },
    playerAngle: number = 0
  ) {
    let x = playerX;
    let y = playerY;
    let attempts = 0;
    const mapW = tileMap ? tileMap.cols * tileMap.tileSize : 3000;
    const mapH = tileMap ? tileMap.rows * tileMap.tileSize : 2500;

    // Bias 65% of spawns into the forward view cone so the road ahead is lively
    do {
      const forwardBias = Math.random() < 0.65;
      const angle = forwardBias
        ? playerAngle + (Math.random() - 0.5) * 1.6
        : Math.random() * Math.PI * 2;
      const dist = 180 + Math.random() * (this.spawnRange - 180);
      x = playerX + Math.cos(angle) * dist;
      y = playerY + Math.sin(angle) * dist;
      attempts++;
    } while (
      tileMap &&
      (x < 20 || x > mapW - 20 || y < 20 || y > mapH - 20 || tileMap.isColliding(x, y)) &&
      attempts < 15
    );

    if (tileMap && tileMap.isColliding(x, y)) return;

    const types: EntityType[] = ['PERSON', 'PERSON', 'PERSON', 'BIKE', 'BIKE', 'MOTORCYCLE', 'CAR', 'CAR'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.entities.push(new Entity(x, y, type));
  }

  /**
   * Projects visible entities into 3D drawables for depth-sorting with 3D buildings.
   */
  getVisibleEntityDrawables(
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
    const nearZ = 14;
    const maxZ = 1300;

    for (const entity of this.entities) {
      if (!entity.isAlive) continue;

      const dx = entity.x - camX;
      const dy = entity.y - camY;
      const tz = dx * cosA + dy * sinA;
      if (tz < nearZ || tz > maxZ) continue;

      const tx = -dx * sinA + dy * cosA;
      const screenX = centerX + (tx / tz) * focalLength;
      if (screenX < -120 || screenX > canvasWidth + 120) continue;

      const screenY = horizonY + (camHeight / tz) * focalLength;
      const scale = focalLength / tz;
      const relAngle = entity.angle - camAngle;
      const depth = Math.hypot(dx, dy);

      drawables.push({
        depth,
        draw: (ctx: CanvasRenderingContext2D) => {
          entity.draw3D(ctx, screenX, screenY, scale, relAngle);
        },
      });
    }

    return drawables;
  }
}
