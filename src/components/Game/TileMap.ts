export type TileType = 'ROAD' | 'BUILDING' | 'SIDEWALK' | 'GRASS' | 'WATER' | 'SAND';

export interface Drawable3D {
  depth: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

interface Vec3 {
  tx: number; // right in camera space
  ty: number; // down from camera height (camHeight - wz)
  tz: number; // forward depth in camera space
}

interface ScreenPt {
  x: number;
  y: number;
}

export class TileMap {
  tileSize: number = 100;
  grid: TileType[][] = [];
  rows: number = 25;
  cols: number = 30;

  // Pre-rendered ground texture for fast Mode 7 floor projection
  private texScale: number = 0.25; // 1 texel = 4 world units (750x625 texture)
  private texWidth: number = 0;
  private texHeight: number = 0;
  private groundPixels: Uint32Array = new Uint32Array(0);
  private outOfBoundsColor: number = 0xff28110a; // ABGR for #0a1128 deep synthwave ocean

  // Offscreen low-res Mode 7 floor buffer (scaled up with pixelated rendering)
  private mode7Canvas: HTMLCanvasElement;
  private mode7Ctx: CanvasRenderingContext2D | null;
  private mode7ImageData: ImageData | null = null;
  private mode7Buf32: Uint32Array = new Uint32Array(0);
  private readonly mode7W: number = 360;
  private readonly mode7H: number = 150;

  constructor() {
    this.mode7Canvas = document.createElement('canvas');
    this.mode7Canvas.width = this.mode7W;
    this.mode7Canvas.height = this.mode7H;
    this.mode7Ctx = this.mode7Canvas.getContext('2d');
    if (this.mode7Ctx) {
      this.mode7ImageData = this.mode7Ctx.createImageData(this.mode7W, this.mode7H);
      this.mode7Buf32 = new Uint32Array(this.mode7ImageData.data.buffer);
    }

    this.generateMap();
    this.buildGroundTexture();
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

  private buildGroundTexture() {
    const worldW = this.cols * this.tileSize;
    const worldH = this.rows * this.tileSize;
    this.texWidth = Math.floor(worldW * this.texScale);
    this.texHeight = Math.floor(worldH * this.texScale);

    const offscreen = document.createElement('canvas');
    offscreen.width = this.texWidth;
    offscreen.height = this.texHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(this.texScale, this.texScale);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = this.grid[r][c];
        const x = c * this.tileSize;
        const y = r * this.tileSize;

        switch (type) {
          case 'ROAD': {
            // Top Gear 3000 deep twilight highway asphalt
            ctx.fillStyle = '#1b1b2f';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);

            // Inner road surface track
            ctx.fillStyle = '#151525';
            ctx.fillRect(x + 8, y + 8, this.tileSize - 16, this.tileSize - 16);

            // Alternating Neon Cyan / Red-White Arcade Rumble Curbs at road edges
            const drawRumbleH = (ry: number) => {
              ctx.fillStyle = '#00e5ff';
              ctx.fillRect(x, ry, this.tileSize, 4);
              ctx.fillStyle = '#ff2a85';
              ctx.fillRect(x + 12, ry, 24, 4);
              ctx.fillRect(x + 62, ry, 24, 4);
            };
            const drawRumbleV = (rx: number) => {
              ctx.fillStyle = '#00e5ff';
              ctx.fillRect(rx, y, 4, this.tileSize);
              ctx.fillStyle = '#ff2a85';
              ctx.fillRect(rx, y + 12, 4, 24);
              ctx.fillRect(rx, y + 62, 4, 24);
            };

            if (r > 0 && this.grid[r - 1][c] !== 'ROAD') drawRumbleH(y);
            if (r < this.rows - 1 && this.grid[r + 1][c] !== 'ROAD') drawRumbleH(y + this.tileSize - 4);
            if (c > 0 && this.grid[r][c - 1] !== 'ROAD') drawRumbleV(x);
            if (c < this.cols - 1 && this.grid[r][c + 1] !== 'ROAD') drawRumbleV(x + this.tileSize - 4);

            // Glowing Amber / Gold dashed center lane lines
            ctx.fillStyle = '#ffbe0b';
            const horizRoad = (c > 0 && this.grid[r][c - 1] === 'ROAD') || (c < this.cols - 1 && this.grid[r][c + 1] === 'ROAD');
            const vertRoad = (r > 0 && this.grid[r - 1][c] === 'ROAD') || (r < this.rows - 1 && this.grid[r + 1][c] === 'ROAD');

            if (horizRoad && !vertRoad) {
              ctx.fillRect(x + 10, y + this.tileSize / 2 - 3, 30, 6);
              ctx.fillRect(x + 60, y + this.tileSize / 2 - 3, 30, 6);
            } else if (vertRoad && !horizRoad) {
              ctx.fillRect(x + this.tileSize / 2 - 3, y + 10, 6, 30);
              ctx.fillRect(x + this.tileSize / 2 - 3, y + 60, 6, 30);
            } else {
              // Neon cyber-crosswalk / intersection grid markers
              ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
              ctx.fillRect(x + 16, y + this.tileSize / 2 - 2, 20, 4);
              ctx.fillRect(x + 64, y + this.tileSize / 2 - 2, 20, 4);
              ctx.fillRect(x + this.tileSize / 2 - 2, y + 16, 4, 20);
              ctx.fillRect(x + this.tileSize / 2 - 2, y + 64, 4, 20);
            }
            break;
          }
          case 'BUILDING': {
            // Neon-trimmed plaza apron around building base
            ctx.fillStyle = '#2a2845';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            ctx.fillStyle = '#ff2a85';
            ctx.fillRect(x + 4, y + 4, this.tileSize - 8, this.tileSize - 8);
            ctx.fillStyle = '#121024';
            ctx.fillRect(x + 6, y + 6, this.tileSize - 12, this.tileSize - 12);
            break;
          }
          case 'GRASS': {
            // Top Gear 3000 twilight bio-turf (deep emerald-teal with synthwave grid & flora)
            ctx.fillStyle = '#102536';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            ctx.fillStyle = '#153447';
            ctx.fillRect(x, y, this.tileSize, 4);
            ctx.fillRect(x, y, 4, this.tileSize);
            ctx.fillStyle = '#00b894';
            for (let i = 0; i < 6; i++) {
              ctx.fillRect(x + ((i * 37 + 12) % (this.tileSize - 12)), y + ((i * 23 + 8) % (this.tileSize - 12)), 10, 10);
            }
            ctx.fillStyle = '#00e5ff';
            for (let i = 0; i < 3; i++) {
              ctx.fillRect(x + ((i * 53 + 20) % (this.tileSize - 10)), y + ((i * 41 + 16) % (this.tileSize - 10)), 6, 6);
            }
            break;
          }
          case 'WATER': {
            // Synthwave night ocean reflecting neon magenta & cyan sky
            ctx.fillStyle = '#0a1128';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(x + 10, y + 20, this.tileSize - 20, 6);
            ctx.fillStyle = '#ff2a85';
            ctx.fillRect(x + 24, y + 60, this.tileSize - 48, 6);
            break;
          }
          case 'SAND': {
            // Twilight sunset dunes (plum-violet with warm dusk orange ripples)
            ctx.fillStyle = '#36193b';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            ctx.fillStyle = '#522157';
            ctx.fillRect(x, y + 45, this.tileSize, 8);
            ctx.fillStyle = '#c85a32';
            for (let i = 0; i < 8; i++) {
              ctx.fillRect(x + ((i * 19 + 7) % (this.tileSize - 8)), y + ((i * 29 + 11) % (this.tileSize - 8)), 8, 6);
            }
            break;
          }
          case 'SIDEWALK':
          default: {
            // Futuristic dark slate plaza with neon grid seams
            ctx.fillStyle = '#26243d';
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            ctx.fillStyle = '#3b375e';
            const s = this.tileSize / 2;
            ctx.fillRect(x, y, this.tileSize, 4);
            ctx.fillRect(x, y + s, this.tileSize, 4);
            ctx.fillRect(x, y, 4, this.tileSize);
            ctx.fillRect(x + s, y, 4, this.tileSize);
            // Subtle cyan node dots at tile intersections
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(x + s - 2, y + s - 2, 6, 6);
            break;
          }
        }
      }
    }

    ctx.restore();
    const imgData = ctx.getImageData(0, 0, this.texWidth, this.texHeight);
    this.groundPixels = new Uint32Array(imgData.data.buffer);
  }

  /**
   * Renders the Top Gear 3000 style horizon sky + Mode 7 perspective ground plane.
   */
  drawSkyAndGround(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    camAngle: number,
    camHeight: number,
    horizonY: number,
    focalLength: number,
    canvasWidth: number,
    canvasHeight: number
  ) {
    // 1. SKY GRADIENT (Top Gear 3000 synthwave / twilight horizon)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#09051d');
    skyGrad.addColorStop(0.45, '#1e1044');
    skyGrad.addColorStop(0.78, '#7a2267');
    skyGrad.addColorStop(1, '#f06848');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvasWidth, horizonY + 2);

    // Normalize camera angle to [0, 2*PI) for parallax sky elements
    const twoPi = Math.PI * 2;
    const normAngle = ((camAngle % twoPi) + twoPi) % twoPi;

    // Stars in upper sky
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 28; i++) {
      const starAngle = (i * 1.37) % twoPi;
      let dAngle = starAngle - normAngle;
      if (dAngle < -Math.PI) dAngle += twoPi;
      if (dAngle > Math.PI) dAngle -= twoPi;
      const sx = canvasWidth / 2 + dAngle * focalLength;
      const sy = ((i * 43) % Math.max(20, Math.floor(horizonY * 0.55)));
      if (sx >= 0 && sx <= canvasWidth) {
        const size = (i % 3 === 0) ? 3 : 2;
        ctx.fillRect(sx, sy, size, size);
      }
    }

    // Retro Sun with horizontal synthwave scanline cutouts on the horizon
    let sunAngleDiff = 0.4 - normAngle;
    if (sunAngleDiff < -Math.PI) sunAngleDiff += twoPi;
    if (sunAngleDiff > Math.PI) sunAngleDiff -= twoPi;
    const sunX = canvasWidth / 2 + sunAngleDiff * focalLength;
    const sunRadius = Math.min(canvasWidth, canvasHeight) * 0.095;
    if (sunX > -sunRadius * 2 && sunX < canvasWidth + sunRadius * 2) {
      const sunY = horizonY - sunRadius * 0.6;
      const sunGrad = ctx.createLinearGradient(sunX, sunY - sunRadius, sunX, sunY + sunRadius);
      sunGrad.addColorStop(0, '#ffee55');
      sunGrad.addColorStop(0.55, '#ff5e57');
      sunGrad.addColorStop(1, '#ff2a85');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // Synthwave horizontal stripes across lower half of sun
      ctx.fillStyle = '#5a1b54';
      for (let s = 0; s < 4; s++) {
        const sliceY = sunY + s * (sunRadius * 0.18);
        ctx.fillRect(sunX - sunRadius, sliceY, sunRadius * 2, 2 + s);
      }
    }

    // Parallax Distant Mountains & Cyber City Skyline Silhouette along the horizon
    ctx.fillStyle = '#140828';
    const numPeaks = 36;
    const angleStep = twoPi / numPeaks;
    for (let i = 0; i < numPeaks; i++) {
      const a0 = i * angleStep;
      let da = a0 - normAngle;
      while (da < -Math.PI) da += twoPi;
      while (da > Math.PI) da -= twoPi;

      const x0 = canvasWidth / 2 + da * focalLength;
      const w = (angleStep * focalLength) + 3;
      if (x0 + w < 0 || x0 > canvasWidth) continue;

      const silHeight = 14 + ((i * 29 + 7) % 36);
      ctx.fillRect(x0, horizonY - silHeight, w, silHeight);

      // Neon cyan/magenta skyline windows
      if (i % 2 === 0 && silHeight > 22) {
        ctx.fillStyle = i % 4 === 0 ? 'rgba(0, 229, 255, 0.5)' : 'rgba(255, 42, 133, 0.5)';
        ctx.fillRect(x0 + 4, horizonY - silHeight + 6, Math.max(2, w * 0.3), 3);
        ctx.fillRect(x0 + 4, horizonY - silHeight + 13, Math.max(2, w * 0.3), 3);
        ctx.fillStyle = '#140828';
      }
    }

    // 2. MODE 7 GROUND PLANE
    if (!this.mode7Ctx || !this.mode7ImageData || this.groundPixels.length === 0) return;

    const groundScreenH = Math.max(1, canvasHeight - horizonY);
    const cosA = Math.cos(camAngle);
    const sinA = Math.sin(camAngle);
    const bufW = this.mode7W;
    const bufH = this.mode7H;
    const buf32 = this.mode7Buf32;
    const texW = this.texWidth;
    const texH = this.texHeight;
    const texScale = this.texScale;
    const groundTex = this.groundPixels;
    const outColor = this.outOfBoundsColor;
    const halfW = canvasWidth * 0.5;

    for (let by = 0; by < bufH; by++) {
      const syOffset = ((by + 0.6) / bufH) * groundScreenH;
      const tz = Math.min(1800, (camHeight * focalLength) / Math.max(1.5, syOffset));

      const txLeft = (-halfW * tz) / focalLength;
      const txRight = (halfW * tz) / focalLength;
      const dTx = (txRight - txLeft) / bufW;

      let wx = camX + tz * cosA - txLeft * sinA;
      let wy = camY + tz * sinA + txLeft * cosA;
      const dWx = -dTx * sinA;
      const dWy = dTx * cosA;

      const rowOffset = by * bufW;

      // Subtle synthwave magenta/violet horizon haze for far rows
      const isFar = tz > 900;
      const isVeryFar = tz > 1300;

      for (let bx = 0; bx < bufW; bx++) {
        const tx = (wx * texScale) | 0;
        const ty = (wy * texScale) | 0;

        let color = outColor;
        if (tx >= 0 && tx < texW && ty >= 0 && ty < texH) {
          color = groundTex[ty * texW + tx];
        }

        if (isVeryFar) {
          const r = ((color & 0xff) + 0x6a) >> 1;
          const g = (((color >> 8) & 0xff) + 0x20) >> 1;
          const b = (((color >> 16) & 0xff) + 0x58) >> 1;
          color = (0xff << 24) | (b << 16) | (g << 8) | r;
        } else if (isFar) {
          const r = ((color & 0xff) * 3 + 0x6a) >> 2;
          const g = (((color >> 8) & 0xff) * 3 + 0x20) >> 2;
          const b = (((color >> 16) & 0xff) * 3 + 0x58) >> 2;
          color = (0xff << 24) | (b << 16) | (g << 8) | r;
        }

        buf32[rowOffset + bx] = color;
        wx += dWx;
        wy += dWy;
      }
    }

    this.mode7Ctx.putImageData(this.mode7ImageData, 0, 0);

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mode7Canvas, 0, horizonY, canvasWidth, groundScreenH);
    ctx.imageSmoothingEnabled = prevSmoothing;

    // Neon horizon separator line
    ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.fillRect(0, horizonY - 1, canvasWidth, 2);
  }

  /**
   * Clips a 3D polygon against the camera near plane (tz >= nearZ) and projects to 2D screen coords.
   */
  private clipAndProjectQuad(
    pts: Vec3[],
    nearZ: number,
    centerX: number,
    horizonY: number,
    focalLength: number
  ): ScreenPt[] | null {
    const clipped: Vec3[] = [];
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const curr = pts[i];
      const next = pts[(i + 1) % n];
      const currIn = curr.tz >= nearZ;
      const nextIn = next.tz >= nearZ;

      if (currIn) {
        clipped.push(curr);
      }
      if (currIn !== nextIn) {
        const t = (nearZ - curr.tz) / (next.tz - curr.tz);
        clipped.push({
          tx: curr.tx + t * (next.tx - curr.tx),
          ty: curr.ty + t * (next.ty - curr.ty),
          tz: nearZ,
        });
      }
    }

    if (clipped.length < 3) return null;

    return clipped.map(p => ({
      x: centerX + (p.tx / p.tz) * focalLength,
      y: horizonY + (p.ty / p.tz) * focalLength,
    }));
  }

  /**
   * Returns depth-sortable 3D building walls and roadside neon props within the camera frustum.
   */
  getVisibleBuildingDrawables(
    camX: number,
    camY: number,
    camAngle: number,
    camHeight: number,
    horizonY: number,
    focalLength: number,
    canvasWidth: number
  ): Drawable3D[] {
    const drawables: Drawable3D[] = [];
    const maxDist = 1350;
    const nearZ = 10;
    const centerX = canvasWidth * 0.5;
    const cosA = Math.cos(camAngle);
    const sinA = Math.sin(camAngle);

    const minCol = Math.max(0, Math.floor((camX - maxDist) / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((camX + maxDist) / this.tileSize));
    const minRow = Math.max(0, Math.floor((camY - maxDist) / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((camY + maxDist) / this.tileSize));

    const toCam = (wx: number, wy: number, wz: number): Vec3 => {
      const dx = wx - camX;
      const dy = wy - camY;
      return {
        tx: -dx * sinA + dy * cosA,
        ty: camHeight - wz,
        tz: dx * cosA + dy * sinA,
      };
    };

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const tileType = this.grid[r][c];
        const cx = (c + 0.5) * this.tileSize;
        const cy = (r + 0.5) * this.tileSize;
        const cdx = cx - camX;
        const cdy = cy - camY;
        const ctz = cdx * cosA + cdy * sinA;
        const ctxLat = -cdx * sinA + cdy * cosA;

        // Frustum cull tiles behind camera or far outside horizontal FOV
        if (ctz < -80 || ctz > maxDist) continue;
        if (Math.abs(ctxLat) > Math.max(140, ctz * 1.35 + 110)) continue;

        // Roadside 3D Neon Streetlamps & Synthwave Palm Trees on Sidewalks / Grass
        if (tileType !== 'BUILDING') {
          const isSidewalkLamp = tileType === 'SIDEWALK' && (r + c) % 2 === 0;
          const isSynthTree = (tileType === 'GRASS' || tileType === 'SAND') && (r * 7 + c * 13) % 7 === 0;

          if ((isSidewalkLamp || isSynthTree) && ctz > 18 && ctz < 950) {
            const screenX = centerX + (ctxLat / ctz) * focalLength;
            if (screenX >= -60 && screenX <= canvasWidth + 60) {
              const screenY = horizonY + (camHeight / ctz) * focalLength;
              const s = Math.min(12, focalLength / ctz);
              const depth = Math.hypot(cdx, cdy);

              if (isSidewalkLamp) {
                const neonColor = (r + c) % 4 === 0 ? '#00e5ff' : '#ff2a85';
                drawables.push({
                  depth,
                  draw: (ctx: CanvasRenderingContext2D) => {
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    // Pole
                    ctx.fillStyle = '#2d3436';
                    ctx.fillRect(-1.2 * s, -48 * s, 2.4 * s, 48 * s);
                    // Lamp arm
                    ctx.fillRect(-1.2 * s, -48 * s, 8 * s, 2 * s);
                    // Glowing neon bulb
                    ctx.fillStyle = neonColor;
                    ctx.fillRect(3 * s, -47 * s, 6 * s, 3 * s);
                    ctx.restore();
                  },
                });
              } else if (isSynthTree) {
                drawables.push({
                  depth,
                  draw: (ctx: CanvasRenderingContext2D) => {
                    ctx.save();
                    ctx.translate(screenX, screenY);
                    // Trunk with neon rings
                    ctx.fillStyle = '#2c1638';
                    ctx.fillRect(-2 * s, -36 * s, 4 * s, 36 * s);
                    ctx.fillStyle = '#ff2a85';
                    ctx.fillRect(-2 * s, -28 * s, 4 * s, 2 * s);
                    ctx.fillRect(-2 * s, -18 * s, 4 * s, 2 * s);
                    // Cyber-Palm Canopy
                    ctx.fillStyle = '#00e5ff';
                    ctx.fillRect(-12 * s, -40 * s, 24 * s, 4 * s);
                    ctx.fillStyle = '#00b894';
                    ctx.fillRect(-9 * s, -45 * s, 18 * s, 5 * s);
                    ctx.restore();
                  },
                });
              }
            }
          }
          continue;
        }

        const style = (r + c) % 3;
        const bHeight = style === 0 ? 115 : style === 1 ? 95 : 155;
        const inset = 6;

        const x0 = c * this.tileSize + inset;
        const x1 = (c + 1) * this.tileSize - inset;
        const y0 = r * this.tileSize + inset;
        const y1 = (r + 1) * this.tileSize - inset;

        // Top Gear 3000 Futuristic Neon Metropolis palette per building style
        const wallColorNS = style === 0 ? '#1e1a3d' : style === 1 ? '#381730' : '#111936';
        const wallColorEW = style === 0 ? '#15122b' : style === 1 ? '#291023' : '#0b1126';
        const accentColor = style === 0 ? '#ff2a85' : style === 1 ? '#ff6b4a' : '#00e5ff';
        const windowColor = style === 0 ? '#ffbe0b' : style === 1 ? '#ffd166' : '#00e5ff';

        // Helper to emit a visible vertical wall face
        const addWall = (
          wxA: number,
          wyA: number,
          wxB: number,
          wyB: number,
          baseColor: string,
          closestX: number,
          closestY: number
        ) => {
          const p0 = toCam(wxA, wyA, 0);
          const p1 = toCam(wxB, wyB, 0);
          if (p0.tz < nearZ && p1.tz < nearZ) return;

          const p2 = toCam(wxB, wyB, bHeight);
          const p3 = toCam(wxA, wyA, bHeight);

          const poly = this.clipAndProjectQuad([p0, p1, p2, p3], nearZ, centerX, horizonY, focalLength);
          if (!poly) return;

          // Screen-space horizontal bounds check
          let minX = Infinity;
          let maxX = -Infinity;
          for (const pt of poly) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
          }
          if (maxX < 0 || minX > canvasWidth) return;

          // Band stripe / neon sign / glass curtain band on the wall
          const bandLow = style === 0 ? 18 : 28;
          const bandHigh = style === 0 ? 32 : bHeight - 18;
          const b0 = toCam(wxA, wyA, bandLow);
          const b1 = toCam(wxB, wyB, bandLow);
          const b2 = toCam(wxB, wyB, bandHigh);
          const b3 = toCam(wxA, wyA, bandHigh);
          const bandPoly = this.clipAndProjectQuad([b0, b1, b2, b3], nearZ, centerX, horizonY, focalLength);

          // Upper glowing window band
          let winPoly: ScreenPt[] | null = null;
          if (style !== 2) {
            const w0 = toCam(wxA, wyA, bHeight * 0.55);
            const w1 = toCam(wxB, wyB, bHeight * 0.55);
            const w2 = toCam(wxB, wyB, bHeight * 0.75);
            const w3 = toCam(wxA, wyA, bHeight * 0.75);
            winPoly = this.clipAndProjectQuad([w0, w1, w2, w3], nearZ, centerX, horizonY, focalLength);
          }

          const midX = (wxA + wxB) * 0.5;
          const midY = (wyA + wyB) * 0.5;
          const depth =
            Math.hypot(closestX - camX, closestY - camY) +
            0.005 * Math.hypot(midX - camX, midY - camY);

          drawables.push({
            depth,
            draw: (ctx: CanvasRenderingContext2D) => {
              ctx.fillStyle = baseColor;
              ctx.beginPath();
              ctx.moveTo(poly[0].x, poly[0].y);
              for (let i = 1; i < poly.length; i++) {
                ctx.lineTo(poly[i].x, poly[i].y);
              }
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = accentColor;
              ctx.lineWidth = 1.5;
              ctx.stroke();

              if (bandPoly) {
                ctx.fillStyle = accentColor;
                ctx.beginPath();
                ctx.moveTo(bandPoly[0].x, bandPoly[0].y);
                for (let i = 1; i < bandPoly.length; i++) {
                  ctx.lineTo(bandPoly[i].x, bandPoly[i].y);
                }
                ctx.closePath();
                ctx.fill();
              }

              if (winPoly) {
                ctx.fillStyle = windowColor;
                ctx.beginPath();
                ctx.moveTo(winPoly[0].x, winPoly[0].y);
                for (let i = 1; i < winPoly.length; i++) {
                  ctx.lineTo(winPoly[i].x, winPoly[i].y);
                }
                ctx.closePath();
                ctx.fill();
              }
            },
          });
        };

        // Only emit the 1 or 2 faces of the building that face toward the camera
        if (camY < y0) {
          addWall(x0, y0, x1, y0, wallColorNS, Math.max(x0, Math.min(x1, camX)), y0);
        } else if (camY > y1) {
          addWall(x1, y1, x0, y1, wallColorNS, Math.max(x0, Math.min(x1, camX)), y1);
        }

        if (camX < x0) {
          addWall(x0, y1, x0, y0, wallColorEW, x0, Math.max(y0, Math.min(y1, camY)));
        } else if (camX > x1) {
          addWall(x1, y0, x1, y1, wallColorEW, x1, Math.max(y0, Math.min(y1, camY)));
        }
      }
    }

    return drawables;
  }

  isColliding(x: number, y: number, radius: number = 0): boolean {
    if (radius <= 0) {
      const col = Math.floor(x / this.tileSize);
      const row = Math.floor(y / this.tileSize);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
      return this.grid[row][col] === 'BUILDING' || this.grid[row][col] === 'WATER';
    }

    // Check bounding points around (x, y) for physical hull collision
    const offsets = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius * 0.7, radius * 0.7],
      [-radius * 0.7, radius * 0.7],
      [radius * 0.7, -radius * 0.7],
      [-radius * 0.7, -radius * 0.7],
    ];

    for (const [ox, oy] of offsets) {
      const col = Math.floor((x + ox) / this.tileSize);
      const row = Math.floor((y + oy) / this.tileSize);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return true;
      const cell = this.grid[row][col];
      if (cell === 'BUILDING' || cell === 'WATER') return true;
    }
    return false;
  }

  drawMinimap(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
    const scaleX = width / (this.cols * this.tileSize);
    const scaleY = height / (this.rows * this.tileSize);
    const tileW = width / this.cols;
    const tileH = height / this.rows;

    // Top Gear 3000 Radar Minimap background
    ctx.fillStyle = 'rgba(9, 5, 29, 0.85)';
    ctx.fillRect(x, y, width, height);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const type = this.grid[r][c];
        const tx = x + c * tileW;
        const ty = y + r * tileH;

        switch (type) {
          case 'ROAD': ctx.fillStyle = '#3d3963'; break;
          case 'BUILDING': ctx.fillStyle = '#ff2a85'; break;
          case 'GRASS': ctx.fillStyle = '#102536'; break;
          case 'WATER': ctx.fillStyle = '#00e5ff'; break;
          case 'SAND': ctx.fillStyle = '#36193b'; break;
          case 'SIDEWALK': ctx.fillStyle = '#26243d'; break;
          default: ctx.fillStyle = '#151525';
        }
        ctx.fillRect(tx, ty, tileW + 0.5, tileH + 0.5);
      }
    }

    // Neon Cyan Radar Border
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    return { scaleX, scaleY };
  }
}
