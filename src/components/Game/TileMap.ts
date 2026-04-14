export type TileType = 'ROAD' | 'BUILDING' | 'SIDEWALK' | 'GRASS' | 'WATER' | 'SAND';

export class TileMap {
  tileSize: number = 100;
  grid: TileType[][] = [];
  rows: number = 25;
  cols: number = 30;

  constructor() {
    this.generateMap();
  }

  generateMap() {
    // Layout key:
    // S: Sand, G: Grass, W: Water, R: Road, B: Building, .: Sidewalk
    const mapLayout = [
      "SSSSSSSRRRRRRSSSSSSSGGGGGGGGGG",
      "SSSRRRR......RRSSSSSSGGGGGGGGG",
      "SSRR.........RRRSSSSSGGGGGGGGG",
      "SRR..BBBBBB..RRRRRSSSGGGGGGGGG",
      "RR...BBBBBB....RRRRSSGGGGGGGGG",
      "R....BBBBBB.....RRRRRGGGGGGGGG",
      "R....BBBBBB.......RRRRGGGGGGGG",
      "R....BBBBBB........RRRGGGGGGGG",
      "R..RRRRRRRRRRRRR....RRGGGGGGGG",
      "R..R...........R....RRBGGGGGGG",
      "R..R.BBBB.BBBB.R....RRBGGGGGGG",
      "R..R.BBBB.BBBB.R....RRBGGGGGGG",
      "R..R...........R....RRRGGGGGGG",
      "R..RRRRRRRRRRRRR....RRRGGGGGGG",
      "R...............R...RRRGGGGGGG",
      "R...BBBBBBBBBB..R...RRRGGGGGGG",
      "R...BBBBBBBBBB..R...RRRGGGGGGG",
      "R...BBBBBBBBBB..R...RRRGGGGGGG",
      "R...............R...RRRGGGGGGG",
      "RRRRRRRRRRRRRRRRR...RRRGGGGGGG",
      "GGGGGGGGGGGGGGGGGG..RRRGGGGGGG",
      "GGGGGGGGGGGGGGGGGG..RRRWWWWGGG",
      "GGGGGGGGGGGGGGGGGG..RRRWWWWGGG",
      "GGGGGGGGGGGGGGGGGG..RRRWWWWGGG",
      "GGGGGGGGGGGGGGGGGG..RRRRRRRGGG"
    ];

    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      const rowStr = mapLayout[r] || "S".repeat(this.cols);
      for (let c = 0; c < this.cols; c++) {
        const char = rowStr[c] || "S";
        switch (char) {
          case 'R': this.grid[r][c] = 'ROAD'; break;
          case 'B': this.grid[r][c] = 'BUILDING'; break;
          case '.': this.grid[r][c] = 'SIDEWALK'; break;
          case 'G': this.grid[r][c] = 'GRASS'; break;
          case 'W': this.grid[r][c] = 'WATER'; break;
          case 'S':
          default:
            this.grid[r][c] = 'SAND'; break;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, playerX: number, playerY: number, canvasWidth: number, canvasHeight: number) {
    const startCol = Math.max(0, Math.floor((playerX - canvasWidth / 2) / this.tileSize));
    const endCol = Math.min(this.cols - 1, Math.floor((playerX + canvasWidth / 2) / this.tileSize));
    const startRow = Math.max(0, Math.floor((playerY - canvasHeight / 2) / this.tileSize));
    const endRow = Math.min(this.rows - 1, Math.floor((playerY + canvasHeight / 2) / this.tileSize));

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const type = this.grid[r][c];
        const x = c * this.tileSize;
        const y = r * this.tileSize;

        switch (type) {
          case 'ROAD':
            ctx.fillStyle = '#444444';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Dashed white lines for roads
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            if (this.grid[r] && this.grid[r][c-1] === 'ROAD' && this.grid[r][c+1] === 'ROAD') {
                ctx.fillRect(x, y + this.tileSize / 2 - 2, this.tileSize, 4);
            } else if (this.grid[r-1] && this.grid[r-1][c] === 'ROAD' && this.grid[r+1] && this.grid[r+1][c] === 'ROAD') {
                ctx.fillRect(x + this.tileSize / 2 - 2, y, 4, this.tileSize);
            }
            break;
          case 'BUILDING':
            ctx.fillStyle = '#95a5a6'; 
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            
            // Building Style based on position
            const style = (r + c) % 3; 
            
            if (style === 0) {
                // SHOP / APARTMENT STYLE
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(x + 10, y + 10, this.tileSize - 15, this.tileSize - 15);
                // Base
                ctx.fillStyle = '#7f8c8d';
                ctx.fillRect(x + 5, y + 5, this.tileSize - 15, this.tileSize - 15);
                // Windows (grid)
                ctx.fillStyle = '#f1c40f';
                for(let i=0; i<3; i++) {
                    for(let j=0; j<3; j++) {
                        ctx.fillRect(x + 15 + i*25, y + 15 + j*25, 10, 10);
                    }
                }
                // Awning (Pixel art shop feel)
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(x + 5, y + 5, this.tileSize - 15, 10);
            } else if (style === 1) {
                // BRICK RESIDENTIAL
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(x + 15, y + 15, this.tileSize - 25, this.tileSize - 25);
                ctx.fillStyle = '#a04000'; // Brick red
                ctx.fillRect(x + 10, y + 10, this.tileSize - 25, this.tileSize - 25);
                // Roof detail
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(x + 20, y + 20, this.tileSize - 45, this.tileSize - 45);
                // Chimney
                ctx.fillStyle = '#333';
                ctx.fillRect(x + 15, y + 15, 8, 8);
            } else {
                // MODERN OFFICE
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(x + 8, y + 8, this.tileSize - 16, this.tileSize - 16);
                ctx.fillStyle = '#2c3e50';
                ctx.fillRect(x + 5, y + 5, this.tileSize - 16, this.tileSize - 16);
                // Blue glass windows
                ctx.fillStyle = '#3498db';
                ctx.fillRect(x + 15, y + 15, this.tileSize - 36, this.tileSize - 36);
                // Reflective shine
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(x + 20, y + 20, 10, this.tileSize - 46);
            }
            break;
          case 'GRASS':
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Grass blades (random pixels)
            ctx.fillStyle = '#2ecc71';
            for(let i=0; i<5; i++) {
                ctx.fillRect(x + (i*37)%this.tileSize, y + (i*13)%this.tileSize, 4, 4);
            }
            break;
          case 'WATER':
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Shimmer (waves)
            ctx.fillStyle = '#3498db';
            ctx.fillRect(x + 10, y + 20, this.tileSize - 20, 4);
            ctx.fillRect(x + 30, y + 50, this.tileSize - 60, 4);
            break;
          case 'SAND':
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Grains
            ctx.fillStyle = '#f39c12';
            for(let i=0; i<10; i++) {
                ctx.fillRect(x + (i*19)%this.tileSize, y + (i*29)%this.tileSize, 2, 2);
            }
            break;
          case 'SIDEWALK':
          default:
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Smaller paving stones (footwear/calçamento)
            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 1;
            const s = this.tileSize / 4;
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    ctx.strokeRect(x + i * s, y + j * s, s, s);
                    // Light texture
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.fillRect(x + i * s + 1, y + j * s + 1, 2, 2);
                }
            }
            break;
        }
      }
    }
  }

  isColliding(x: number, y: number): boolean {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
    return this.grid[row][col] === 'BUILDING' || this.grid[row][col] === 'WATER';
  }

  drawMinimap(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
    const scaleX = width / (this.cols * this.tileSize);
    const scaleY = height / (this.rows * this.tileSize);
    const tileW = width / this.cols;
    const tileH = height / this.rows;

    // Minimap background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, width, height);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = this.grid[r][c];
        const tx = x + c * tileW;
        const ty = y + r * tileH;

        switch (type) {
          case 'ROAD': ctx.fillStyle = '#666'; break;
          case 'BUILDING': ctx.fillStyle = '#2c3e50'; break;
          case 'GRASS': ctx.fillStyle = '#27ae60'; break;
          case 'WATER': ctx.fillStyle = '#2980b9'; break;
          case 'SAND': ctx.fillStyle = '#f1c40f'; break;
          case 'SIDEWALK': ctx.fillStyle = '#bdc3c7'; break;
          default: ctx.fillStyle = '#333';
        }
        ctx.fillRect(tx, ty, tileW + 0.5, tileH + 0.5); // +0.5 to avoid gaps
      }
    }

    // Border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    return { scaleX, scaleY };
  }
}
