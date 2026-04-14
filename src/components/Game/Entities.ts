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
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 50 + Math.random() * 50;
    this.walkPhase = Math.random() * Math.PI * 2;

    switch (type) {
      case 'PERSON':
        this.width = 10;
        this.height = 10;
        this.points = 1;
        this.color = '#FF9F43'; // Vibrant Orange
        this.speed = 35;
        break;
      case 'BIKE':
        this.width = 18;
        this.height = 18;
        this.points = 2;
        this.color = '#54A0FF'; // Bright Sky Blue
        break;
      case 'MOTORCYCLE':
        this.width = 24;
        this.height = 24;
        this.points = 5;
        this.color = '#5F27CD'; // Deep Purple
        this.speed = 110;
        break;
      case 'CAR':
        this.width = 44;
        this.height = 24;
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
            // Turn around or change direction randomly
            this.angle += Math.PI * (0.5 + Math.random()); 
        }
    }

    // Small chance to change direction
    if (Math.random() < 0.01) {
      this.angle += (Math.random() - 0.5) * 0.5;
    }

    // Update walk animation phase
    if (this.type === 'PERSON') {
        this.walkPhase += dt * 10;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    
    const w = this.width;
    const h = this.height;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-w/2 + 1, -h/2 + 1, w, h);

    if (this.type === 'PERSON') {
      const swing = Math.sin(this.walkPhase) * 4; // Swing distance
      
      // Legs (below body)
      ctx.fillStyle = '#341f97'; // Blue pants
      // Left leg
      ctx.fillRect(-w/2 + 1, swing, 3, 4);
      // Right leg
      ctx.fillRect(w/2 - 4, -swing, 3, 4);

      // Arms
      ctx.fillStyle = '#ffcc99'; // Skin tone
      // Left arm
      ctx.fillRect(-w/2 - 2, -swing, 2, 4);
      // Right arm
      ctx.fillRect(w/2, swing, 2, 4);

      // Body (Shirt)
      ctx.fillStyle = this.color;
      ctx.fillRect(-w/2, -h/2, w, h);
      
      // Head
      ctx.fillStyle = '#ffcc99'; // Skin tone
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Hair/Cap
      ctx.fillStyle = '#222';
      ctx.fillRect(-2, -1, 4, 2);

    } else if (this.type === 'BIKE') {
      // Frame
      ctx.fillStyle = this.color;
      ctx.fillRect(-w/2, -h/8, w, h/4);
      // Wheels
      ctx.fillStyle = '#333';
      ctx.fillRect(w/4, -h/4, 2, h/2);
      ctx.fillRect(-w/2, -h/4, 2, h/2);
      // Rider
      ctx.fillStyle = '#e67e22';
      ctx.fillRect(-2, -2, 4, 4);
    } else if (this.type === 'MOTORCYCLE') {
      // Wheels
      ctx.fillStyle = '#333';
      ctx.fillRect(w/2 - 6, -2, 6, 4); // Front wheel
      ctx.fillRect(-w/2, -2, 8, 4);   // Back wheel

      // Exhaust pipe
      ctx.fillStyle = '#777';
      ctx.fillRect(-w/2 + 2, h/4, w/2, 2);

      // Main Body/Frame
      ctx.fillStyle = this.color;
      ctx.fillRect(-w/3, -h/4, w/1.5, h/2);
      
      // Handlebars
      ctx.fillStyle = '#555';
      ctx.fillRect(w/4, -h/2, 2, h);

      // Rider
      // Body
      ctx.fillStyle = '#222'; // Dark leather jacket
      ctx.fillRect(-w/6, -h/3, w/3, h/1.5);
      
      // Helmet
      ctx.fillStyle = '#fff'; // White helmet
      ctx.beginPath();
      ctx.arc(-w/12, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      // Visor
      ctx.fillStyle = '#111';
      ctx.fillRect(0, -2, 2, 4);

      // Arms reaching for handlebars
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w/6, -h/3); ctx.lineTo(w/4, -h/2 + 2);
      ctx.moveTo(-w/6, h/3); ctx.lineTo(w/4, h/2 - 2);
      ctx.stroke();

      // Headlight
      ctx.fillStyle = 'rgba(255, 255, 200, 0.8)';
      ctx.fillRect(w/2 - 4, -h/6, 3, h/3);
    } else if (this.type === 'CAR') {
      // Main Body
      ctx.fillStyle = this.color;
      ctx.fillRect(-w/2, -h/2, w, h);
      // Roof (Darker shade)
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-w/3, -h/2 + 2, w/1.5, h - 4);
      // Windows
      ctx.fillStyle = '#111';
      ctx.fillRect(w/6, -h/2 + 3, w/10, h - 6); // windshield
      ctx.fillRect(-w/4, -h/2 + 3, w/12, h - 6); // back window
      // Lights
      ctx.fillStyle = '#ffffcc'; // Front
      ctx.fillRect(w/2 - 2, -h/2 + 1, 2, 4);
      ctx.fillRect(w/2 - 2, h/2 - 5, 2, 4);
      ctx.fillStyle = '#ff3333'; // Back
      ctx.fillRect(-w/2, -h/2 + 1, 2, 4);
      ctx.fillRect(-w/2, h/2 - 5, 2, 4);
    }

    ctx.restore();
  }
}

export class EntityManager {
  entities: Entity[] = [];
  maxEntities: number = 50;
  spawnRange: number = 800; // Relative to player

  update(dt: number, playerX: number, playerY: number, tileMap?: { isColliding: (x: number, y: number) => boolean, rows: number, cols: number, tileSize: number }) {
    // Remove far away or dead entities
    this.entities = this.entities.filter(e => {
      const dist = Math.hypot(e.x - playerX, e.y - playerY);
      return e.isAlive && dist < this.spawnRange + 200;
    });

    // Spawn new entities if needed
    while (this.entities.length < this.maxEntities) {
      this.spawnEntity(playerX, playerY, tileMap);
    }

    this.entities.forEach(e => e.update(dt, tileMap));
  }

  spawnEntity(playerX: number, playerY: number, tileMap?: { isColliding: (x: number, y: number) => boolean, rows: number, cols: number, tileSize: number }) {
    let x, y, dist, angle;
    let attempts = 0;
    
    // Try to find a valid spot
    do {
      angle = Math.random() * Math.PI * 2;
      dist = this.spawnRange - 200 + Math.random() * 300;
      x = playerX + Math.cos(angle) * dist;
      y = playerY + Math.sin(angle) * dist;
      attempts++;
    } while (tileMap && tileMap.isColliding(x, y) && attempts < 10);

    const types: EntityType[] = ['PERSON', 'PERSON', 'PERSON', 'BIKE', 'BIKE', 'MOTORCYCLE', 'CAR', 'CAR'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.entities.push(new Entity(x, y, type));
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.entities.forEach(e => e.draw(ctx));
  }
}
