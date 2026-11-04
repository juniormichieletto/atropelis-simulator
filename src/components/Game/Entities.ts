import type { Drawable3D } from './TileMap';

export type EntityType = 'PERSON' | 'BIKE' | 'MOTORCYCLE' | 'CAR';

interface CarPalette {
  body: string;
  bodyDark: string;
  cabin: string;
  accent: string;
}

const RIVAL_CAR_PALETTES: CarPalette[] = [
  { body: '#ff2a55', bodyDark: '#b8143a', cabin: '#d91e49', accent: '#ffbe0b' }, // Crimson Interceptor
  { body: '#ff6b35', bodyDark: '#bf4319', cabin: '#e05324', accent: '#00e5ff' }, // Solar GT
  { body: '#e84118', bodyDark: '#9c2309', cabin: '#c23616', accent: '#ffee55' }, // Diablo Red
];

export class Entity {
  x: number;
  y: number;
  z: number = 0; // Vertical elevation above ground (for 3D accident launch arc)
  type: EntityType;
  width: number;
  height: number;
  angle: number;
  speed: number;
  points: number;
  color: string;
  palette: CarPalette;
  isAlive: boolean = true;
  walkPhase: number = 0; // For person / wheel / pedal animation

  // Accident launch / ragdoll physics state
  isHit: boolean = false;
  vx: number = 0;
  vy: number = 0;
  vz: number = 0;
  spinAngle: number = 0;
  spinSpeed: number = 0;
  hitTimer: number = 0;
  readonly maxHitDuration: number = 0.95;

  constructor(x: number, y: number, type: EntityType) {
    this.x = x;
    this.y = y;
    this.type = type;
    // Align mostly with city grid directions (0, PI/2, PI, 3PI/2) with slight variation
    const cardinal = Math.floor(Math.random() * 4) * (Math.PI / 2);
    this.angle = cardinal + (Math.random() - 0.5) * 0.25;
    this.speed = 50 + Math.random() * 50;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.palette = RIVAL_CAR_PALETTES[Math.floor(Math.random() * RIVAL_CAR_PALETTES.length)];

    switch (type) {
      case 'PERSON':
        this.width = 10;
        this.height = 10;
        this.points = 1;
        this.color = '#FF9F43'; // Vibrant Orange
        this.speed = 35;
        break;
      case 'BIKE':
        this.width = 14;
        this.height = 14;
        this.points = 2;
        this.color = '#00e5ff'; // Neon Cyan
        this.speed = 70;
        break;
      case 'MOTORCYCLE':
        this.width = 18;
        this.height = 18;
        this.points = 5;
        this.color = '#9d4edd'; // Cyber Purple
        this.speed = 115;
        break;
      case 'CAR':
        this.width = 36;
        this.height = 22;
        this.points = -5;
        this.color = this.palette.body;
        this.speed = 130;
        break;
    }
  }

  /**
   * Launches the entity into a 3D flying ragdoll / accident trajectory ahead of the car before removal.
   */
  triggerHit(playerX: number, playerY: number, playerAngle: number, playerSpeed: number) {
    if (this.isHit) return;
    this.isHit = true;
    this.hitTimer = 0;

    const cosA = Math.cos(playerAngle);
    const sinA = Math.sin(playerAngle);
    const dx = this.x - playerX;
    const dy = this.y - playerY;
    // Lateral offset relative to car centerline (-left, +right)
    const lateral = -dx * sinA + dy * cosA;
    const lateralSign = lateral >= 0 ? 1 : -1;

    const impactSpeed = Math.max(220, Math.abs(playerSpeed));
    const forwardFling = this.type === 'CAR' ? impactSpeed * 0.85 : impactSpeed * 1.45;
    const sideFling = lateralSign * (this.type === 'CAR' ? 55 : 70 + Math.abs(lateral) * 1.8);

    // World velocity = forward vector * forwardFling + right vector * sideFling
    this.vx = cosA * forwardFling - sinA * sideFling;
    this.vy = sinA * forwardFling + cosA * sideFling;
    this.vz = this.type === 'CAR' ? 75 : 150 + impactSpeed * 0.42;

    this.spinSpeed = lateralSign * (this.type === 'CAR' ? 5 : 13 + Math.random() * 6);
  }

  update(
    dt: number,
    tileMap?: { isColliding: (x: number, y: number) => boolean; rows: number; cols: number; tileSize: number }
  ) {
    if (this.isHit) {
      this.hitTimer += dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.z += this.vz * dt;
      this.vz -= 430 * dt; // Gravity
      this.spinAngle += this.spinSpeed * dt;
      this.walkPhase += dt * 28; // Flailing limbs / spinning wheels while airborne

      // Bounce on pavement
      if (this.z < 0) {
        this.z = 0;
        this.vz = -this.vz * 0.42;
        this.vx *= 0.68;
        this.vy *= 0.68;
        this.spinSpeed *= 0.65;
      }

      if (this.hitTimer >= this.maxHitDuration) {
        this.isAlive = false;
      }
      return;
    }

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

    // Update walk / wheel animation phase
    this.walkPhase += dt * 10;
  }

  /**
   * Renders the entity in 3D behind-the-car perspective anchored at its ground shadow (screenX, screenY).
   * Vehicles and motorcycles use Top Gear 3000 sculpted polygons, spoilers, exhausts, and neon lighting.
   */
  draw3D(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    scale: number,
    relAngle: number
  ) {
    // Clamp near-camera scale so entities never balloon past the camera plane
    const s = Math.min(scale, 10.5);
    if (s < 0.15) return;

    const side = Math.sin(relAngle); // -1 (moving left) to +1 (moving right)
    const away = Math.cos(relAngle); // +1 (moving away) to -1 (oncoming)
    const airOffsetY = this.z * s;
    const shadowScale = Math.max(0.35, 1 - this.z / 180);
    const treadTick = Math.floor(this.walkPhase) % 2 === 0;

    // Fade out slightly in the final 20% of the accident flight
    const alpha = this.isHit
      ? Math.max(0, Math.min(1, (this.maxHitDuration - this.hitTimer) / 0.22))
      : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === 'PERSON') {
      const spriteW = 2.8 * s;
      const spriteH = 6.6 * s;
      const swing = Math.sin(this.walkPhase) * 0.9 * s;

      // 1. Ground shadow on pavement
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(
        screenX,
        screenY,
        spriteW * 0.65 * shadowScale,
        Math.max(1, 0.9 * s * shadowScale),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 2. Person body
      ctx.translate(screenX, screenY - airOffsetY - spriteH * 0.5);
      if (this.isHit) {
        ctx.rotate(this.spinAngle);
      }
      ctx.translate(0, spriteH * 0.5);

      // Legs
      ctx.fillStyle = '#341f97';
      ctx.fillRect(-spriteW * 0.36, -spriteH * 0.38 + swing * 0.45, spriteW * 0.28, spriteH * 0.38);
      ctx.fillRect(spriteW * 0.08, -spriteH * 0.38 - swing * 0.45, spriteW * 0.28, spriteH * 0.38);

      // Torso
      ctx.fillStyle = this.color;
      ctx.fillRect(-spriteW * 0.44, -spriteH * 0.75, spriteW * 0.88, spriteH * 0.4);

      // Arms
      ctx.fillStyle = '#ffcc99';
      const armSpread = this.isHit ? spriteW * 0.22 : 0;
      ctx.fillRect(-spriteW * 0.66 - armSpread, -spriteH * 0.72 - swing * 0.4, spriteW * 0.22 + armSpread, spriteH * 0.28);
      ctx.fillRect(spriteW * 0.44, -spriteH * 0.72 + swing * 0.4, spriteW * 0.22 + armSpread, spriteH * 0.28);

      // Head & Cap
      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(-spriteW * 0.28, -spriteH * 0.98, spriteW * 0.56, spriteH * 0.23);
      ctx.fillStyle = '#222';
      ctx.fillRect(-spriteW * 0.3, -spriteH, spriteW * 0.6, spriteH * 0.1);
    } else if (this.type === 'BIKE') {
      // Top Gear 3000 Futuristic Neon Racing Cyclist
      const bikeW = (3.4 + Math.abs(side) * 4.2) * s;
      const bikeH = 7.4 * s;
      const sideShift = side * 2.1 * s;
      const pedalSwing = Math.sin(this.walkPhase * 1.4) * 0.6 * s;

      // 1. Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(
        screenX,
        screenY,
        bikeW * 0.7 * shadowScale,
        Math.max(1.2, 1.2 * s * shadowScale),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.translate(screenX, screenY - airOffsetY - bikeH * 0.5);
      if (this.isHit) {
        ctx.rotate(this.spinAngle);
      }
      ctx.translate(0, bikeH * 0.5);

      // 2. Aero Disc / Spoked Wheels with Neon Cyan Rim Highlights
      const drawBikeWheel = (wx: number) => {
        ctx.fillStyle = '#141418';
        ctx.fillRect(wx - 0.85 * s, -3.4 * s, 1.7 * s, 3.4 * s);
        ctx.fillStyle = treadTick ? '#00e5ff' : '#00a8cc';
        ctx.fillRect(wx - 0.45 * s, -3.0 * s, 0.9 * s, 2.6 * s);
        ctx.fillStyle = '#1e272e';
        ctx.fillRect(wx - 0.25 * s, -2.5 * s, 0.5 * s, 1.6 * s);
      };
      drawBikeWheel(-sideShift);
      if (Math.abs(side) > 0.2) {
        drawBikeWheel(sideShift);
      }

      // 3. Sculpted Carbon/Neon Diamond Frame
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = Math.max(1.4, 0.75 * s);
      ctx.beginPath();
      ctx.moveTo(-sideShift, -1.7 * s);
      ctx.lineTo(-sideShift * 0.2, -3.8 * s);
      ctx.lineTo(sideShift * 0.85, -3.6 * s);
      ctx.lineTo(sideShift, -1.7 * s);
      ctx.closePath();
      ctx.stroke();

      // Rear LED safety beacon
      ctx.fillStyle = away >= 0 ? '#ff2a85' : '#ffee55';
      ctx.fillRect(-sideShift * 0.3 - 0.5 * s, -3.7 * s, 1.0 * s, 0.7 * s);

      // 4. Cyclist Legs (Pedaling motion)
      ctx.fillStyle = '#191d24';
      ctx.fillRect(-1.2 * s + sideShift * 0.2, -3.8 * s + pedalSwing, 0.9 * s, 2.0 * s);
      ctx.fillRect(0.3 * s + sideShift * 0.2, -3.8 * s - pedalSwing, 0.9 * s, 2.0 * s);

      // 5. Drop Handlebars
      ctx.fillStyle = '#dfe6e9';
      ctx.fillRect(sideShift * 0.7 - 1.9 * s, -4.9 * s, 3.8 * s, 0.55 * s);

      // 6. Aerodynamic Leaning Rider Torso (Neon Racing Jersey)
      ctx.fillStyle = '#ff2a85';
      ctx.beginPath();
      ctx.moveTo(-1.4 * s + sideShift * 0.15, -3.8 * s);
      ctx.lineTo(1.4 * s + sideShift * 0.15, -3.8 * s);
      ctx.lineTo(1.7 * s + sideShift * 0.35, -6.0 * s);
      ctx.lineTo(-1.7 * s + sideShift * 0.35, -6.0 * s);
      ctx.closePath();
      ctx.fill();

      // Racing stripe on jersey back
      ctx.fillStyle = '#ffee55';
      ctx.fillRect(-0.4 * s + sideShift * 0.25, -5.9 * s, 0.8 * s, 2.0 * s);

      // Rider arms reaching to handlebars
      ctx.fillStyle = '#ffcc99';
      ctx.fillRect(-1.6 * s + sideShift * 0.45, -5.6 * s, 0.55 * s, 1.2 * s);
      ctx.fillRect(1.05 * s + sideShift * 0.45, -5.6 * s, 0.55 * s, 1.2 * s);

      // 7. Teardrop Aero Cycling Helmet & Visor
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-1.1 * s + sideShift * 0.4, -5.9 * s);
      ctx.lineTo(1.1 * s + sideShift * 0.4, -5.9 * s);
      ctx.lineTo(0.8 * s + sideShift * 0.45, -bikeH);
      ctx.lineTo(-0.8 * s + sideShift * 0.45, -bikeH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(-0.9 * s + sideShift * 0.42, -6.8 * s, 1.8 * s, 0.45 * s);
    } else if (this.type === 'MOTORCYCLE') {
      // Top Gear 3000 Cyber-Superbike (matches PlayerCar visual style & detail!)
      const motoW = (5.2 + Math.abs(side) * 5.0) * s;
      const motoH = 8.0 * s;
      const yaw = side * 2.4 * s;

      // 1. Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(
        screenX,
        screenY,
        motoW * 0.72 * shadowScale,
        Math.max(1.5, 1.5 * s * shadowScale),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.translate(screenX, screenY - airOffsetY - motoH * 0.5);
      if (this.isHit) {
        ctx.rotate(this.spinAngle);
      }
      ctx.translate(0, motoH * 0.5);

      // 2. Front Wheel (visible when angled/turning)
      if (Math.abs(side) > 0.15) {
        const fwX = yaw * 0.95;
        ctx.fillStyle = '#141418';
        ctx.fillRect(fwX - 1.1 * s, -3.6 * s, 2.2 * s, 3.6 * s);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(fwX - 0.5 * s, -2.9 * s, 1.0 * s, 2.2 * s);
      }

      // 3. Extra-Wide Superbike Rear Slick Tire with Animated Tread Grooves
      const rwX = -yaw * 0.35;
      ctx.fillStyle = '#141418';
      ctx.fillRect(rwX - 1.55 * s, -3.8 * s, 3.1 * s, 3.8 * s);
      ctx.fillStyle = '#26262e';
      ctx.fillRect(rwX - 1.25 * s, -3.5 * s, 2.5 * s, 3.3 * s);
      ctx.fillStyle = treadTick ? '#111115' : '#353542';
      ctx.fillRect(rwX - 1.15 * s, -3.0 * s, 2.3 * s, 0.5 * s);
      ctx.fillRect(rwX - 1.15 * s, -2.0 * s, 2.3 * s, 0.5 * s);
      ctx.fillRect(rwX - 1.15 * s, -1.0 * s, 2.3 * s, 0.5 * s);

      // 4. Dual Upswept Titanium Exhaust Pipes + Plasma Flame Glow
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(rwX - 2.3 * s, -2.9 * s, 0.85 * s, 1.6 * s);
      ctx.fillRect(rwX + 1.45 * s, -2.9 * s, 0.85 * s, 1.6 * s);
      ctx.fillStyle = '#111';
      ctx.fillRect(rwX - 2.15 * s, -2.7 * s, 0.55 * s, 0.6 * s);
      ctx.fillRect(rwX + 1.6 * s, -2.7 * s, 0.55 * s, 0.6 * s);
      if (away >= 0) {
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(rwX - 2.1 * s, -2.1 * s, 0.45 * s, 0.8 * s);
        ctx.fillRect(rwX + 1.65 * s, -2.1 * s, 0.45 * s, 0.8 * s);
      }

      // 5. Sculpted Aerodynamic Superbike Fairing & Tail Cowling
      ctx.fillStyle = '#7b2cbf';
      ctx.beginPath();
      ctx.moveTo(rwX - 2.4 * s, -2.4 * s);
      ctx.lineTo(rwX + 2.4 * s, -2.4 * s);
      ctx.lineTo(yaw * 0.4 + 2.9 * s, -4.9 * s);
      ctx.lineTo(yaw * 0.4 - 2.9 * s, -4.9 * s);
      ctx.closePath();
      ctx.fill();

      // White & Neon Cyan Top Gear 3000 Superbike Livery Accents
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(yaw * 0.25 - 2.5 * s, -4.7 * s, 0.75 * s, 1.9 * s);
      ctx.fillRect(yaw * 0.25 + 1.75 * s, -4.7 * s, 0.75 * s, 1.9 * s);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(yaw * 0.25 - 1.75 * s, -4.6 * s, 3.5 * s, 0.45 * s);

      // 6. Tail / Front Light Assembly
      ctx.fillStyle = '#191d24';
      ctx.fillRect(rwX - 1.8 * s, -4.3 * s, 3.6 * s, 1.2 * s);
      if (away >= 0) {
        // Twin glowing LED taillights + license plate
        ctx.fillStyle = '#ff1e42';
        ctx.fillRect(rwX - 1.65 * s, -4.15 * s, 1.15 * s, 0.85 * s);
        ctx.fillRect(rwX + 0.5 * s, -4.15 * s, 1.15 * s, 0.85 * s);
        ctx.fillStyle = '#ff9f1a';
        ctx.fillRect(rwX - 1.4 * s, -3.95 * s, 0.65 * s, 0.4 * s);
        ctx.fillRect(rwX + 0.75 * s, -3.95 * s, 0.65 * s, 0.4 * s);
        ctx.fillStyle = '#ffbe0b';
        ctx.fillRect(rwX - 0.4 * s, -3.1 * s, 0.8 * s, 0.6 * s);
      } else {
        // Oncoming twin laser headlights
        ctx.fillStyle = '#ffffaa';
        ctx.fillRect(rwX - 1.6 * s, -4.15 * s, 1.2 * s, 0.9 * s);
        ctx.fillRect(rwX + 0.4 * s, -4.15 * s, 1.2 * s, 0.9 * s);
      }

      // 7. Armored Racing Rider (tucked into speed crouch)
      ctx.fillStyle = '#1e242b';
      ctx.beginPath();
      ctx.moveTo(yaw * 0.3 - 2.1 * s, -4.7 * s);
      ctx.lineTo(yaw * 0.3 + 2.1 * s, -4.7 * s);
      ctx.lineTo(yaw * 0.55 + 1.5 * s, -6.7 * s);
      ctx.lineTo(yaw * 0.55 - 1.5 * s, -6.7 * s);
      ctx.closePath();
      ctx.fill();

      // Neon spine & shoulder armor pads
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(yaw * 0.45 - 2.2 * s, -6.3 * s, 0.7 * s, 1.1 * s);
      ctx.fillRect(yaw * 0.45 + 1.5 * s, -6.3 * s, 0.7 * s, 1.1 * s);
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(yaw * 0.45 - 0.35 * s, -6.4 * s, 0.7 * s, 1.6 * s);

      // 8. Racing Helmet with Horizon Visor
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(yaw * 0.55 - 1.25 * s, -6.5 * s);
      ctx.lineTo(yaw * 0.55 + 1.25 * s, -6.5 * s);
      ctx.lineTo(yaw * 0.65 + 0.95 * s, -motoH);
      ctx.lineTo(yaw * 0.65 - 0.95 * s, -motoH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#191d24';
      ctx.fillRect(yaw * 0.6 - 1.05 * s, -7.45 * s, 2.1 * s, 0.55 * s);
      ctx.fillStyle = '#ff2a85';
      ctx.fillRect(yaw * 0.6 - 0.85 * s, -7.35 * s, 1.7 * s, 0.25 * s);
    } else if (this.type === 'CAR') {
      // Top Gear 3000 Rival Supercar (matches PlayerCar.drawRearView architecture & detail!)
      const halfW = (6.8 + Math.abs(side) * 2.0) * s;
      const carH = 7.6 * s;
      const yaw = side * 2.2 * s;
      const pal = this.palette;

      // 1. Ground Shadow underneath supercar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(
        screenX,
        screenY + 0.3 * s,
        halfW * 1.06 * shadowScale,
        Math.max(1.5, 1.5 * s * shadowScale),
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.translate(screenX, screenY - airOffsetY - carH * 0.5);
      if (this.isHit) {
        ctx.rotate(this.spinAngle);
      }
      ctx.translate(0, carH * 0.5);

      // 2. Front wheels peeking out when turning/angled
      if (Math.abs(side) > 0.15) {
        ctx.fillStyle = '#141418';
        const fwX = side > 0 ? halfW * 0.85 : -halfW * 1.08;
        ctx.fillRect(fwX, -3.2 * s, halfW * 0.22, 2.3 * s);
      }

      // 3. Wide Racing Slicks with Animated Tread Grooves
      const drawSupercarTire = (tx: number) => {
        const tw = halfW * 0.36;
        ctx.fillStyle = '#141418';
        ctx.fillRect(tx, -2.9 * s, tw, 3.0 * s);
        ctx.fillStyle = '#26262e';
        ctx.fillRect(tx + tw * 0.1, -2.7 * s, tw * 0.8, 2.6 * s);
        ctx.fillStyle = treadTick ? '#111115' : '#32323d';
        ctx.fillRect(tx + tw * 0.14, -2.3 * s, tw * 0.72, 0.45 * s);
        ctx.fillRect(tx + tw * 0.14, -1.5 * s, tw * 0.72, 0.45 * s);
        ctx.fillRect(tx + tw * 0.14, -0.7 * s, tw * 0.72, 0.45 * s);
      };
      drawSupercarTire(-halfW * 0.94 + yaw * 0.2);
      drawSupercarTire(halfW * 0.58 + yaw * 0.2);

      // 4. Lower Rear Diffuser & Dual Twin Exhaust Pipes
      ctx.fillStyle = '#1e242b';
      ctx.fillRect(-halfW * 0.62 + yaw * 0.25, -1.9 * s, halfW * 1.24, 1.45 * s);

      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(-halfW * 0.5 + yaw * 0.25, -1.3 * s, halfW * 0.2, 0.7 * s);
      ctx.fillRect(halfW * 0.3 + yaw * 0.25, -1.3 * s, halfW * 0.2, 0.7 * s);
      ctx.fillStyle = away >= 0 ? '#00e5ff' : '#111';
      ctx.fillRect(-halfW * 0.46 + yaw * 0.25, -1.1 * s, halfW * 0.12, 0.4 * s);
      ctx.fillRect(halfW * 0.34 + yaw * 0.25, -1.1 * s, halfW * 0.12, 0.4 * s);

      // 5. Tapered Wide-Body Aerodynamic Lower Chassis & Side Fenders
      ctx.fillStyle = pal.bodyDark;
      ctx.beginPath();
      ctx.moveTo(-halfW + yaw * 0.15, -1.65 * s);
      ctx.lineTo(halfW + yaw * 0.15, -1.65 * s);
      ctx.lineTo(halfW * 0.9 + yaw * 0.45, -4.75 * s);
      ctx.lineTo(-halfW * 0.9 + yaw * 0.45, -4.75 * s);
      ctx.closePath();
      ctx.fill();

      // Main bright supercar body highlight
      ctx.fillStyle = pal.body;
      ctx.fillRect(-halfW * 0.88 + yaw * 0.3, -4.55 * s, halfW * 1.76, 1.65 * s);

      // Side air intakes on flanks
      ctx.fillStyle = '#191d24';
      ctx.fillRect(-halfW * 0.85 + yaw * 0.3, -3.9 * s, halfW * 0.17, 0.65 * s);
      ctx.fillRect(halfW * 0.68 + yaw * 0.3, -3.9 * s, halfW * 0.17, 0.65 * s);

      // 6. Top Gear 3000 Tail Panel (or Front Grille when oncoming)
      ctx.fillStyle = '#191d24';
      ctx.fillRect(-halfW * 0.82 + yaw * 0.3, -4.25 * s, halfW * 1.64, 1.55 * s);

      if (away >= 0) {
        // Quad Glowing Red/Amber Taillights + License Plate
        ctx.fillStyle = '#ff1e1e';
        ctx.fillRect(-halfW * 0.78 + yaw * 0.3, -4.05 * s, halfW * 0.24, 1.15 * s);
        ctx.fillRect(-halfW * 0.5 + yaw * 0.3, -4.05 * s, halfW * 0.2, 1.15 * s);
        ctx.fillRect(halfW * 0.3 + yaw * 0.3, -4.05 * s, halfW * 0.2, 1.15 * s);
        ctx.fillRect(halfW * 0.54 + yaw * 0.3, -4.05 * s, halfW * 0.24, 1.15 * s);

        ctx.fillStyle = '#ff9f1a';
        ctx.fillRect(-halfW * 0.74 + yaw * 0.3, -3.75 * s, halfW * 0.16, 0.5 * s);
        ctx.fillRect(halfW * 0.58 + yaw * 0.3, -3.75 * s, halfW * 0.16, 0.5 * s);

        // Center Neon License Plate
        ctx.fillStyle = pal.accent;
        ctx.fillRect(-halfW * 0.19 + yaw * 0.3, -4.05 * s, halfW * 0.38, 1.1 * s);
        ctx.fillStyle = '#111';
        ctx.fillRect(-halfW * 0.15 + yaw * 0.3, -3.65 * s, halfW * 0.3, 0.35 * s);
      } else {
        // Oncoming Quad Xenon/Laser Headlights + Front Splitter Intake
        ctx.fillStyle = '#ffffaa';
        ctx.fillRect(-halfW * 0.78 + yaw * 0.3, -4.05 * s, halfW * 0.25, 1.1 * s);
        ctx.fillRect(-halfW * 0.49 + yaw * 0.3, -4.0 * s, halfW * 0.18, 0.95 * s);
        ctx.fillRect(halfW * 0.31 + yaw * 0.3, -4.0 * s, halfW * 0.18, 0.95 * s);
        ctx.fillRect(halfW * 0.53 + yaw * 0.3, -4.05 * s, halfW * 0.25, 1.1 * s);

        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(-halfW * 0.74 + yaw * 0.3, -3.75 * s, halfW * 0.17, 0.45 * s);
        ctx.fillRect(halfW * 0.57 + yaw * 0.3, -3.75 * s, halfW * 0.17, 0.45 * s);
      }

      // 7. Upper Fastback Cabin & Tinted Windshield with Horizon Reflections
      ctx.fillStyle = pal.cabin;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.78 + yaw * 0.45, -4.75 * s);
      ctx.lineTo(halfW * 0.78 + yaw * 0.45, -4.75 * s);
      ctx.lineTo(halfW * 0.52 + yaw * 0.75, -carH);
      ctx.lineTo(-halfW * 0.52 + yaw * 0.75, -carH);
      ctx.closePath();
      ctx.fill();

      // Tinted Glass
      ctx.fillStyle = '#191d24';
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.62 + yaw * 0.5, -4.95 * s);
      ctx.lineTo(halfW * 0.62 + yaw * 0.5, -4.95 * s);
      ctx.lineTo(halfW * 0.42 + yaw * 0.75, -carH * 0.93);
      ctx.lineTo(-halfW * 0.42 + yaw * 0.75, -carH * 0.93);
      ctx.closePath();
      ctx.fill();

      // Horizon reflection stripes on glass
      ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.fillRect(-halfW * 0.34 + yaw * 0.6, -6.5 * s, halfW * 0.68, 0.32 * s);
      ctx.fillRect(-halfW * 0.44 + yaw * 0.55, -5.8 * s, halfW * 0.88, 0.32 * s);

      // 8. Top Gear 3000 Elevated Rear Wing / Spoiler with Struts & Endplates
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(-halfW * 0.64 + yaw * 0.5, -6.4 * s, 0.7 * s, 1.8 * s);
      ctx.fillRect(halfW * 0.64 - 0.7 * s + yaw * 0.5, -6.4 * s, 0.7 * s, 1.8 * s);

      // Main spoiler blade
      ctx.fillStyle = pal.body;
      ctx.fillRect(-halfW * 0.9 + yaw * 0.55, -6.95 * s, halfW * 1.8, 0.8 * s);
      ctx.fillStyle = pal.bodyDark;
      ctx.fillRect(-halfW * 0.9 + yaw * 0.55, -6.3 * s, halfW * 1.8, 0.3 * s);

      // Neon winglet endplates
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-halfW * 0.93 + yaw * 0.55, -7.25 * s, 0.7 * s, 1.45 * s);
      ctx.fillRect(halfW * 0.93 - 0.7 * s + yaw * 0.55, -7.25 * s, 0.7 * s, 1.45 * s);
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
      if (screenX < -140 || screenX > canvasWidth + 140) continue;

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
