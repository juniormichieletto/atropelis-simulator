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

  targetX: number | null = null;
  targetY: number | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.speed = 0;
    this.maxSpeed = 350; // pixels per second
    this.acceleration = 200; // pixels per second per second
    this.friction = 0.95; // speed multiplier per second
    this.steeringRate = Math.PI * 1.5; // faster steering for better response
  }

  setTarget(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  clearTarget() {
    this.targetX = null;
    this.targetY = null;
  }

  update(dt: number, input: { forward: boolean, backward: boolean, left: boolean, right: boolean }) {
    let movementInput = { ...input };

    // If we have a target, override keyboard/manual input
    if (this.targetX !== null && this.targetY !== null) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        const targetAngle = Math.atan2(dy, dx);
        
        // Normalize angles to -PI to PI
        let angleDiff = targetAngle - this.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        // Steering logic for target
        if (Math.abs(angleDiff) > 0.05) {
          if (angleDiff > 0) movementInput.right = true;
          else movementInput.left = true;
        }

        // Only move forward if we aren't facing the wrong way too much
        if (Math.abs(angleDiff) < Math.PI / 2) {
          movementInput.forward = true;
        } else {
          // Slow down and turn if pointing away
          movementInput.forward = false;
        }
      } else {
        this.clearTarget();
      }
    }

    // Steering - only when moving
    if (Math.abs(this.speed) > 5) {
      const turnMultiplier = this.speed > 0 ? 1 : -1;
      if (movementInput.left) this.angle -= this.steeringRate * dt * turnMultiplier;
      if (movementInput.right) this.angle += this.steeringRate * dt * turnMultiplier;
    }

    // Acceleration
    if (movementInput.forward) {
      this.speed += this.acceleration * dt;
    } else if (movementInput.backward) {
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
