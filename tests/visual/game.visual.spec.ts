import { test, expect } from '@playwright/test';

test.describe('Atropelis Simulator - Top Gear 3000 Visual & Canvas Suite', () => {
  test('renders Synthwave Name Entry screen with CRT scanlines and neon card', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const card = page.locator('.name-entry-card');
    await expect(card).toBeVisible();
    await expect(page.locator('.crt-overlay')).toBeAttached();

    // Verify Top Gear 3000 neon cyan border color (#00e5ff -> rgb(0, 229, 255))
    const borderColor = await card.evaluate(el => getComputedStyle(el).borderColor);
    expect(borderColor).toBe('rgb(0, 229, 255)');

    await expect(page).toHaveScreenshot('name-entry.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
    });
  });

  test('renders Main Menu screen with original background image', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('atropelis_user_name', 'PLAYER3000');
    });
    await page.reload();

    await expect(page.locator('.welcome-text')).toContainText('WELCOME,');
    await expect(page.locator('.nickname')).toHaveText('PLAYER3000');

    await expect(page).toHaveScreenshot('main-menu.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
    });
  });

  test('renders Hall of Fame Scoreboard screen with deterministic scores', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('atropelis_user_name', 'PLAYER3000');
      localStorage.setItem(
        'atropelis_scores',
        JSON.stringify([
          { date: '2026-11-04', name: 'PLAYER3000', points: 125 },
          { date: '2026-11-04', name: 'OUTRUNNER', points: 80 },
        ])
      );
    });
    await page.reload();

    await page.getByRole('button', { name: 'SCOREBOARD' }).click();
    await expect(page.locator('.scoreboard-card h1')).toHaveText('HALL OF FAME');
    await expect(page.locator('.points-cell').first()).toHaveText('125');

    await expect(page).toHaveScreenshot('scoreboard.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
    });
  });

  test('renders 3D Behind-the-Car Mode 7 canvas, supercar sprite, radar minimap, and tachometer HUD', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('atropelis_user_name', 'PLAYER3000');
    });
    await page.reload();

    await page.getByRole('button', { name: 'START NEW GAME' }).click();

    // Verify controls overlay appears first
    const overlay = page.locator('.controls-overlay');
    await expect(overlay).toBeVisible();
    await expect(page.locator('.controls-card h3')).toHaveText('TOP GEAR 3000 MODE');

    // Dismiss overlay to inspect active 3D behind-the-car view
    await overlay.click();
    await expect(overlay).toBeHidden();

    // Verify HUD Tachometer, Gear badge, Score, and Timer
    await expect(page.locator('.gear-badge')).toBeVisible();
    await expect(page.locator('.rpm-bar-track')).toBeVisible();
    await expect(page.locator('.hud-item.score')).toContainText('SCORE:');
    await expect(page.locator('.hud-item.timer')).toContainText('TIME:');

    // Wait a couple of animation frames and inspect actual Canvas 2D pixel regions
    await page.waitForTimeout(150);

    const canvasProbe = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.game-canvas') as HTMLCanvasElement | null;
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const W = canvas.width;
      const H = canvas.height;

      const sampleAlphaAndBrightness = (x: number, y: number, w: number, h: number) => {
        const data = ctx.getImageData(Math.floor(x), Math.floor(y), w, h).data;
        let nonZeroAlpha = 0;
        let maxChannel = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) nonZeroAlpha++;
          maxChannel = Math.max(maxChannel, data[i], data[i + 1], data[i + 2]);
        }
        return { nonZeroAlpha, maxChannel };
      };

      return {
        // 1. Twilight Sky region above horizon
        sky: sampleAlphaAndBrightness(W * 0.5 - 20, H * 0.2, 40, 20),
        // 2. Mode 7 Ground plane region below horizon
        ground: sampleAlphaAndBrightness(W * 0.5 - 20, H * 0.6, 40, 20),
        // 3. Rear-view Supercar at bottom-center (contains bright white body/spoiler)
        car: sampleAlphaAndBrightness(W * 0.5 - 45, H - 140, 90, 55),
        // 4. Radar Minimap at top-right
        minimap: sampleAlphaAndBrightness(W - 160, 30, 130, 130),
      };
    });

    expect(canvasProbe).not.toBeNull();
    expect(canvasProbe!.sky.nonZeroAlpha).toBeGreaterThan(0);
    expect(canvasProbe!.sky.maxChannel).toBeGreaterThan(30);
    expect(canvasProbe!.ground.nonZeroAlpha).toBeGreaterThan(0);
    expect(canvasProbe!.ground.maxChannel).toBeGreaterThan(20);
    // Supercar has bright white (#ffffff) and neon highlights
    expect(canvasProbe!.car.maxChannel).toBeGreaterThan(200);
    expect(canvasProbe!.minimap.nonZeroAlpha).toBeGreaterThan(0);
  });
});
