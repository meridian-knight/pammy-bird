// Generates the home-screen icons (apple-touch 180, icon-192, icon-512) and the
// 1200x630 social preview from the same 32x32 Pam grid the game draws
// (src/art/agent-grid.js). The favicons (favicon.svg, favicon.ico,
// favicon-16.png, favicon-32.png) are a hand-drawn 16px Pam matching A5a, committed in
// public/ as delivered: this script does not write them, because a 32px sprite
// downscaled to 16px loses Pam's features.
// The social preview shows a frame captured from the running game, so start the
// dev server (npm run dev) or the preview server first and pass its URL if it is
// not the dev default.
// Usage: node scripts/make-assets.mjs <outDir> [previewFileName] [gameUrl]
// Example: npm run assets   (writes into public/, preview as social-preview-v3.png)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { agentGrid, PALETTE, SPRITE_PX } from '../src/art/agent-grid.js';

const out = process.argv[2] ?? 'public';
const previewName = process.argv[3] ?? 'social-preview-v3.png';
const gameUrl = process.argv[4] ?? 'http://127.0.0.1:5173/';
mkdirSync(out, { recursive: true });

const rects = (g, ox = 0, oy = 0) =>
  g.flatMap((row, y) => row.map((k, x) => (PALETTE[k] ? `<rect x="${ox + x}" y="${oy + y}" width="1" height="1" fill="${PALETTE[k]}"/>` : '')).filter(Boolean)).join('');
const svgDoc = (w, h, body, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${bg}${body}</svg>`;

// --- Home-screen icons: Pam (art rows 8-27, all 32 columns) centred on a dusk
// tile, each at a whole number of device px per art pixel: apple-touch 180 = 5x
// on a 36-unit tile, icon-192 = 4x on a 48-unit tile, icon-512 = 12x (1.5 art
// px per unit) on a 64-unit tile.
const TILE_BG = '#2a1d45';
function icon(tile, k) {
  const ox = (tile - SPRITE_PX * k) / 2;
  const oy = (tile - 20 * k) / 2 - 8 * k;
  const pam = `<g transform="translate(${ox} ${oy}) scale(${k})">${rects(agentGrid({ wing: 0, gaze: 'centre' }))}</g>`;
  return svgDoc(tile, tile, pam, `<rect width="${tile}" height="${tile}" rx="${tile / 8}" fill="${TILE_BG}"/>`);
}

const browser = await chromium.launch();

// --- Social preview 1200x630: the title and a large Pam beside a real game frame
// (Melbourne at dusk, brick chimney stacks), captured from the running game.
const game = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
try {
  await game.goto(`${gameUrl}?test&seed=4`);
} catch {
  throw new Error(`No game at ${gameUrl}: run npm run dev (or preview and pass its URL) first.`);
}
await game.waitForFunction(() => window.__glide && window.__glide.frameStats().samples > 5);
await game.locator('#action-btn').click();
await game.waitForFunction(() => window.__glide.getState().status === 'running');
await game.addStyleTag({ content: '#hover-hint{visibility:hidden!important}' });
await game.evaluate(() => {
  window.__glide.setObstacles([
    { id: 3, x: 118, gapY: 150, gapH: 100, passed: false },
    { id: 4, x: 238, gapY: 128, gapH: 100, passed: false },
  ]);
  window.__glide.setAgent({ y: 150, vy: 0 });
  window.__glide.setScene({ scroll: 300, phase: 0 });
});
await game.waitForTimeout(250);
// World x 0-240, y 50-320: the sky band with Pam, both stacks, the skyline and the street.
const m = await game.evaluate(() => window.__glide.boardMetrics());
const box = await game.locator('#board').boundingBox();
const k = m.scale / m.dpr;
const shot = await game.screenshot({
  clip: { x: box.x + m.letterbox[0] / m.dpr, y: box.y + (m.letterbox[1] / m.dpr) + 50 * k, width: 240 * k, height: 270 * k },
});
const sceneW = Math.round(240 * k);
const sceneH = Math.round(270 * k);
await game.close();

const bigPam = svgDoc(SPRITE_PX, 20, `<g transform="translate(0 -8)">${rects(agentGrid({ wing: 1, gaze: 'right' }))}</g>`);
const social = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0e0d18;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#efe4d3}
  .glow{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 30%, rgba(252,196,28,.12), transparent 60%)}
  .frame{position:absolute;inset:36px;border:3px solid #2e2b4a;border-radius:34px;box-shadow:inset 0 0 0 10px #1c1a2e}
  .eyebrow{position:absolute;top:96px;left:96px;font-size:18px;letter-spacing:.3em;color:#8f8ba6;text-transform:uppercase}
  h1{position:absolute;top:124px;left:92px;margin:0;font-size:76px;font-weight:800;letter-spacing:.1em;color:#fcc41c;text-shadow:5px 5px 0 #b8460c,0 0 36px rgba(252,196,28,.35);text-transform:uppercase}
  .tag{position:absolute;top:226px;left:96px;font-size:26px;line-height:1.4;letter-spacing:.04em;color:#f3e6cf}
  .pam{position:absolute;top:322px;left:150px;width:${SPRITE_PX * 10}px;height:${20 * 10}px}
  .pam svg{display:block;width:100%;height:100%;image-rendering:pixelated}
  .scene{position:absolute;right:92px;top:96px;width:${sceneW}px;height:${sceneH}px;border-radius:10px;overflow:hidden;box-shadow:0 0 0 3px #08070f,0 0 24px rgba(252,196,28,.1)}
  .scene img{display:block;width:100%;height:100%}
  .foot{position:absolute;bottom:62px;left:96px;font-size:18px;letter-spacing:.16em;color:#8f8ba6;text-transform:uppercase}
</style></head><body>
  <div class="glow"></div><div class="frame"></div>
  <div class="eyebrow">Flappy-style retro fan game</div>
  <h1>Pammy Bird</h1>
  <div class="tag">Tap to flap. Thread the gaps.<br>Beat your best.</div>
  <div class="pam">${bigPam}</div>
  <div class="scene"><img src="data:image/png;base64,${shot.toString('base64')}"></div>
  <div class="foot">Unofficial fan game · Built by Cyber Squad Zero + Claude</div>
</body></html>`;

const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(social);
await page.screenshot({ path: join(out, previewName), clip: { x: 0, y: 0, width: 1200, height: 630 } });

async function pngFromSvg(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:${TILE_BG}}img{display:block;width:${size}px;height:${size}px;image-rendering:pixelated}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await page.screenshot({ path: join(out, file), clip: { x: 0, y: 0, width: size, height: size } });
}
await pngFromSvg(icon(36, 1), 180, 'apple-touch-icon.png');
await pngFromSvg(icon(48, 1), 192, 'icon-192.png');
await pngFromSvg(icon(64, 1.5), 512, 'icon-512.png');
await browser.close();

console.log('assets written (favicons left as committed)');
