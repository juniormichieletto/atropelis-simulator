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

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = 0;
    this.maxSpeed = 300; // pixels per second
    this.acceleration = 150; // pixels per second per second
    this.friction = 0.95; // speed multiplier per second
    this.steeringRate = Math.PI; // one full rotation in 2 seconds
  }

  update(dt: number, input: { forward: boolean, backward: boolean, left: boolean, right: boolean }) {
    // Steering - only when moving
    if (Math.abs(this.speed) > 5) {
      const turnMultiplier = this.speed > 0 ? 1 : -1;
      if (input.left) this.angle -= this.steeringRate * dt * turnMultiplier;
      if (input.right) this.angle += this.steeringRate * dt * turnMultiplier;
    }

    // Acceleration
    if (input.forward) {
      this.speed += this.acceleration * dt;
    } else if (input.backward) {
      this.speed -= this.acceleration * dt;
    } else {
      // Passive Friction
      this.speed *= Math.pow(this.friction, dt * 10);
      if (Math.abs(this.speed) < 1) this.speed = 0;
    }

    // Cap speed
    if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
    if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

    // Apply movement
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    // PIXEL ART WHITE CAR
    const w = this.width;
    const h = this.height;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-w/2 + 2, -h/2 + 2, w, h);

    // Main Body (White)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-w/2, -h/2, w, h);

    // Darker outline/shading for depth
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(-w/2, h/2 - 2, w, 2); // bottom side shadow
    ctx.fillRect(-w/2, -h/2, 2, h); // rear side shadow

    // Roof section (slightly raised/different shade)
    ctx.fillStyle = '#EEEEEE';
    ctx.fillRect(-w/4, -h/2 + 2, w/2, h - 4);

    // Windows (Dark Blue-ish Black)
    ctx.fillStyle = '#1a1a1a';
    // Front windshield
    ctx.fillRect(w/6, -h/2 + 3, w/10, h - 6);
    // Rear window
    ctx.fillRect(-w/3, -h/2 + 4, w/15, h - 8);
    // Side windows
    ctx.fillRect(-w/6, -h/2 + 1, w/3, 1);
    ctx.fillRect(-w/6, h/2 - 2, w/3, 1);

    // Headlights (Yellow)
    ctx.fillStyle = '#FFFFCC';
    ctx.fillRect(w/2 - 3, -h/2 + 1, 3, 4);
    ctx.fillRect(w/2 - 3, h/2 - 5, 3, 4);

    // Taillights (Red)
    ctx.fillStyle = '#FF3333';
    ctx.fillRect(-w/2, -h/2 + 1, 2, 4);
    ctx.fillRect(-w/2, h/2 - 5, 2, 4);

    // Bumpers
    ctx.fillStyle = '#333333';
    ctx.fillRect(w/2 - 1, -h/2 + 4, 1, h - 8); // Front
    ctx.fillRect(-w/2, -h/2 + 4, 1, h - 8); // Rear

    ctx.restore();
  }
}
