export interface CarControlInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  steerAmount?: number; // -1 (full left) to +1 (full right) for touch/mouse steering
  autoAccelerate?: boolean;
}

export class PlayerCar {
  x: number;
  y: number;
  angle: number;
  speed: number;
  maxSpeed: number;
  acceleration: number;
  friction: number;
  steeringRate: number;

  // Dimensions for collision
  width: number = 40;
  height: number = 20;

  // Custom Car Livery Palette (defaults to White Top Gear Supercar)
  color: string = '#ffffff';
  colorDark: string = '#dce1e7';
  accentColor: string = '#e74c3c';

  // Visual state for behind-the-car 3D view
  steerVisual: number = 0; // Smoothed -1..+1 steering angle for sprite & camera lag
  wheelPhase: number = 0;
  isBraking: boolean = false;
  bounceOffset: number = 0;

  // Touch/Pointer steering state (-1 left, 0 straight, +1 right, null inactive)
  pointerSteer: number | null = null;

  constructor(x: number, y: number, angle: number = 0) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.maxSpeed = 350; // pixels per second
    this.acceleration = 220; // pixels per second squared
    this.friction = 0.95;
    this.steeringRate = Math.PI * 1.15;
  }

  /**
   * Sets steering from screen X coordinate (Left side = steer left, Right side = steer right, Center = straight)
   */
  setPointerScreenX(clientX: number, screenWidth: number) {
    const norm = (clientX - screenWidth * 0.5) / (screenWidth * 0.5); // -1 to +1
    if (Math.abs(norm) < 0.14) {
      this.pointerSteer = 0; // Center deadzone drives straight while auto-accelerating
    } else {
      const sign = norm > 0 ? 1 : -1;
      const mag = Math.min(1, (Math.abs(norm) - 0.14) / 0.55);
      this.pointerSteer = sign * Math.max(0.35, mag);
    }
  }

  clearTarget() {
    this.pointerSteer = null;
  }

  update(dt: number, input: CarControlInput) {
    // Combine keyboard steering and touch/mouse left/right steering
    let steerInput = 0;
    if (input.left) steerInput -= 1;
    if (input.right) steerInput += 1;
    if (steerInput === 0 && this.pointerSteer !== null) {
      steerInput = this.pointerSteer;
    }

    // Smooth visual steering for car sprite & camera tilt
    const targetVisual = steerInput;
    this.steerVisual += (targetVisual - this.steerVisual) * Math.min(1, dt * 12);

    // Determine throttle: auto-accelerate is on unless braking
    const wantsBackward = input.backward;
    const autoGas = input.autoAccelerate ?? true;
    const wantsForward = !wantsBackward && (input.forward || autoGas || this.pointerSteer !== null);

    this.isBraking = wantsBackward;

    // Steering - responsive at all speeds so player can always turn away from obstacles
    if (Math.abs(steerInput) > 0.01) {
      const dirMultiplier = this.speed >= -5 ? 1 : -1;
      const speedFactor = Math.max(0.45, Math.min(1, Math.abs(this.speed) / 90));
      this.angle += steerInput * this.steeringRate * speedFactor * dt * dirMultiplier;
    }

    // Acceleration & Braking
    if (wantsForward) {
      // Boost top speed slightly when holding W / ArrowUp explicitly
      const targetMax = input.forward ? this.maxSpeed * 1.1 : this.maxSpeed;
      this.speed += this.acceleration * dt;
      if (this.speed > targetMax) {
        this.speed = targetMax;
      }
    } else if (wantsBackward) {
      // Stronger braking when moving forward, then reverse
      const decel = this.speed > 0 ? this.acceleration * 2.2 : this.acceleration * 1.2;
      this.speed -= decel * dt;
      if (this.speed < -this.maxSpeed * 0.5) {
        this.speed = -this.maxSpeed * 0.5;
      }
    } else {
      // Passive Friction
      this.speed *= Math.pow(this.friction, dt * 10);
      if (Math.abs(this.speed) < 1) this.speed = 0;
    }

    // Advance tire rolling animation & road vibration
    this.wheelPhase += this.speed * dt * 0.12;
    this.bounceOffset = Math.abs(this.speed) > 25 ? Math.sin(this.wheelPhase * 1.8) * 1.2 : 0;

    // Apply movement
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }

  /**
   * 🔒 REGRA ESTRITA DE DESIGN (DIMENSION & SCALE FREEZE - NÃO ALTERAR):
   * As dimensões base do carro (largura 164px, altura 72px) e suas fórmulas
   * de escala responsiva (Desktop: W/900 clamp 0.85..1.25; Mobile Paisagem: H/500 clamp 0.65..1.0)
   * estão congeladas e aprovadas pelo usuário.
   *
   * Returns current on-screen visual footprint of the car in pixels.
   */
  getVisualDimensions(canvasWidth: number, canvasHeight: number): { width: number; height: number; scale: number } {
    const isLandscapeMobile = canvasHeight < 520;
    const scale = isLandscapeMobile
      ? Math.max(0.65, Math.min(1.0, canvasHeight / 500))
      : Math.max(0.85, Math.min(1.25, canvasWidth / 900));
    return { width: 164 * scale, height: 72 * scale, scale };
  }

  /**
   * Renders the player's car in Top Gear 3000 behind-the-car perspective at the bottom center of the screen.
   */
  drawRearView(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    ctx.save();

    const isLandscapeMobile = canvasHeight < 520;
    const steer = this.steerVisual; // -1..+1
    const carCenterX = canvasWidth * 0.5 + steer * 26;
    const carBottomY = (isLandscapeMobile ? canvasHeight - 52 : canvasHeight - 78) + this.bounceOffset;

    ctx.translate(carCenterX, carBottomY);
    // Subtle chassis body roll into the turn
    ctx.rotate(steer * 0.055);

    // Scale car proportionally for mobile landscape and desktop screens
    const scale = isLandscapeMobile
      ? Math.max(0.65, Math.min(1.0, canvasHeight / 500))
      : Math.max(0.85, Math.min(1.25, canvasWidth / 900));
    ctx.scale(scale, scale);

    const yaw = steer * 14; // Perspective shift showing left/right flank when turning
    const treadTick = Math.floor(this.wheelPhase) % 2 === 0;

    // 1. Ground Shadow underneath car
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 88, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Front wheels peeking out when steering hard left/right
    if (Math.abs(steer) > 0.15) {
      ctx.fillStyle = '#141418';
      const frontWheelX = steer > 0 ? 74 : -92;
      ctx.fillRect(frontWheelX, -32, 18, 22);
    }

    // 3. Wide Rear Tires (Top Gear 3000 thick racing slicks with animated treads)
    const drawTire = (tx: number) => {
      ctx.fillStyle = '#141418';
      ctx.fillRect(tx, -28, 30, 30);
      ctx.fillStyle = '#26262e';
      ctx.fillRect(tx + 3, -26, 24, 26);
      // Rolling tread grooves
      ctx.fillStyle = treadTick ? '#111115' : '#32323d';
      ctx.fillRect(tx + 4, -22, 22, 4);
      ctx.fillRect(tx + 4, -14, 22, 4);
      ctx.fillRect(tx + 4, -6, 22, 4);
    };
    drawTire(-78 + yaw * 0.2);
    drawTire(48 + yaw * 0.2);

    // 4. Lower Rear Diffuser & Dual Twin Exhaust Pipes
    ctx.fillStyle = '#1e242b';
    ctx.fillRect(-52 + yaw * 0.25, -18, 104, 14);

    // Exhaust tips
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-42 + yaw * 0.25, -12, 16, 7);
    ctx.fillRect(26 + yaw * 0.25, -12, 16, 7);
    ctx.fillStyle = '#111';
    ctx.fillRect(-39 + yaw * 0.25, -10, 10, 4);
    ctx.fillRect(29 + yaw * 0.25, -10, 10, 4);

    // Nitro / Exhaust Flames at high speed!
    if (this.speed > 180 && !this.isBraking) {
      const flameLen = 6 + (Math.abs(Math.sin(this.wheelPhase * 3)) * 10);
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(-38 + yaw * 0.25, -7, 8, flameLen);
      ctx.fillRect(30 + yaw * 0.25, -7, 8, flameLen);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-36 + yaw * 0.25, -7, 4, flameLen * 0.6);
      ctx.fillRect(32 + yaw * 0.25, -7, 4, flameLen * 0.6);
    }

    // 5. Lower Wide Aerodynamic Body & Side Fenders (Customizable Livery)
    ctx.fillStyle = this.colorDark;
    ctx.beginPath();
    ctx.moveTo(-82 + yaw * 0.15, -16);
    ctx.lineTo(82 + yaw * 0.15, -16);
    ctx.lineTo(74 + yaw * 0.45, -46);
    ctx.lineTo(-74 + yaw * 0.45, -46);
    ctx.closePath();
    ctx.fill();

    // Main rear fender highlight
    ctx.fillStyle = this.color;
    ctx.fillRect(-72 + yaw * 0.3, -44, 144, 16);

    // Side air intakes visible on flanks
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(-70 + yaw * 0.3, -38, 14, 6);
    ctx.fillRect(56 + yaw * 0.3, -38, 14, 6);

    // 6. Iconic Top Gear 3000 Rear Tail Panel & Taillights
    ctx.fillStyle = '#191d24';
    ctx.fillRect(-68 + yaw * 0.3, -41, 136, 15);

    // Glowing Red/Orange Quad Taillights (brighter & wider glow when braking!)
    const lightColor = this.isBraking ? '#ff1e1e' : '#e84118';
    const innerLight = this.isBraking ? '#ff9f1a' : '#ff6b6b';

    if (this.isBraking) {
      ctx.fillStyle = 'rgba(255, 30, 30, 0.35)';
      ctx.fillRect(-72 + yaw * 0.3, -45, 52, 22);
      ctx.fillRect(20 + yaw * 0.3, -45, 52, 22);
    }

    ctx.fillStyle = lightColor;
    // Left dual taillight bar
    ctx.fillRect(-64 + yaw * 0.3, -39, 20, 11);
    ctx.fillRect(-41 + yaw * 0.3, -39, 16, 11);
    // Right dual taillight bar
    ctx.fillRect(25 + yaw * 0.3, -39, 16, 11);
    ctx.fillRect(44 + yaw * 0.3, -39, 20, 11);

    ctx.fillStyle = innerLight;
    ctx.fillRect(-61 + yaw * 0.3, -36, 14, 5);
    ctx.fillRect(47 + yaw * 0.3, -36, 14, 5);

    // Center License Plate ("ATROPELIS")
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-16 + yaw * 0.3, -39, 32, 11);
    ctx.fillStyle = '#111';
    ctx.fillRect(-13 + yaw * 0.3, -35, 26, 3);

    // 7. Upper Cabin / Fastback Rear Windshield & Louvers
    ctx.fillStyle = '#eef2f7';
    ctx.beginPath();
    ctx.moveTo(-64 + yaw * 0.45, -46);
    ctx.lineTo(64 + yaw * 0.45, -46);
    ctx.lineTo(42 + yaw * 0.75, -72);
    ctx.lineTo(-42 + yaw * 0.75, -72);
    ctx.closePath();
    ctx.fill();

    // Tinted Rear Windshield
    ctx.fillStyle = '#1e272e';
    ctx.beginPath();
    ctx.moveTo(-50 + yaw * 0.5, -48);
    ctx.lineTo(50 + yaw * 0.5, -48);
    ctx.lineTo(34 + yaw * 0.75, -68);
    ctx.lineTo(-34 + yaw * 0.75, -68);
    ctx.closePath();
    ctx.fill();

    // Horizon sky reflection stripe on rear glass
    ctx.fillStyle = 'rgba(240, 104, 72, 0.35)';
    ctx.fillRect(-28 + yaw * 0.6, -63, 56, 3);
    ctx.fillRect(-36 + yaw * 0.55, -56, 72, 3);

    // 8. Top Gear 3000 Elevated Rear Wing / Spoiler
    // Wing struts
    ctx.fillStyle = '#7f8c8d';
    ctx.fillRect(-52 + yaw * 0.5, -62, 6, 18);
    ctx.fillRect(46 + yaw * 0.5, -62, 6, 18);

    // Main spoiler blade
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-74 + yaw * 0.55, -67, 148, 8);
    ctx.fillStyle = '#cfd6de';
    ctx.fillRect(-74 + yaw * 0.55, -61, 148, 3);

    // Racing winglet endplates
    ctx.fillStyle = this.accentColor;
    ctx.fillRect(-76 + yaw * 0.55, -70, 6, 14);
    ctx.fillRect(70 + yaw * 0.55, -70, 6, 14);

    ctx.restore();
  }
}
