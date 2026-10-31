// Generates the home-screen icons (apple-touch 180, icon-192, icon-512) and the
// 1200x630 social preview from the same 32x32 Pam grid the game draws
// (src/art/agent-grid.js). The favicons (favicon.svg, favicon.ico,
// favicon-16.png, favicon-32.png) are Iris's hand-drawn 16px set, committed in
// public/ as delivered: this script does not write them, because a 32px sprite
// downscaled to 16px loses Pam's features.
// Usage: node scripts/make-assets.mjs <outDir> [previewFileName]
// Example: npm run assets   (writes into public/, preview as social-preview-v1.png)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { agentGrid, PALETTE, SPRITE_PX } from '../src/art/agent-grid.js';

const out = process.argv[2] ?? 'public';
const previewName = process.argv[3] ?? 'social-preview-v1.png';
mkdirSync(out, { recursive: true });

const rects = (g, ox = 0, oy = 0) =>
  g.flatMap((row, y) => row.map((k, x) => (PALETTE[k] ? `<rect x="${ox + x}" y="${oy + y}" width="1" height="1" fill="${PALETTE[k]}"/>` : '')).filter(Boolean)).join('');
const svgDoc = (w, h, body, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${bg}${body}</svg>`;

// --- Home-screen icon: Pam (art rows 8-27, all 32 columns) centred on a dark
// rounded tile 36 units square, so the 180px apple-touch icon is an exact 5x.
const TILE = 36;
const PAD_X = (TILE - SPRITE_PX) / 2; // 2
const PAD_Y = (TILE - 20) / 2 - 8; // art rows 8-27 centred vertically
const iconOpaque = svgDoc(TILE, TILE, rects(agentGrid({ wing: 0, gaze: 'centre' }), PAD_X, PAD_Y), `<rect width="${TILE}" height="${TILE}" rx="4.5" fill="#241c16"/>`);

// --- social preview 1200x630: the agent flying between two stacks of chips
const SCENE_W = 132; // scene units (1 unit = 8 px)
const SCENE_H = 25;
const GROUND = 23;
const BLOCK_W = 14;
const BLOCK_H = 7;
function block(x, y, hot) {
  return (
    `<rect x="${x}" y="${y}" width="${BLOCK_W}" height="${BLOCK_H}" fill="${hot ? '#d97757' : '#9a4f36'}"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${BLOCK_W - 2}" height="${BLOCK_H - 2}" fill="#f3e6cf"/>` +
    `<rect x="${x + 1}" y="${y + 1}" width="${BLOCK_W - 2}" height="1" fill="#fff6e6"/>` +
    `<rect x="${x + 3}" y="${y + 3}" width="1" height="1" fill="#d97757"/>` +
    `<rect x="${x + BLOCK_W - 4}" y="${y + 3}" width="1" height="1" fill="#d97757"/>` +
    `<rect x="${x + 6}" y="${y + 3}" width="2" height="1" fill="#f7c948"/>`
  );
}
function stack(x, gapTop, gapBottom) {
  let s = '';
  let first = true;
  for (let y = gapTop - BLOCK_H; y + BLOCK_H > 0; y -= BLOCK_H) {
    s += block(x, y, first);
    first = false;
  }
  first = true;
  for (let y = gapBottom; y < GROUND; y += BLOCK_H) {
    s += block(x, y, first);
    first = false;
  }
  return s;
}
const scene =
  `<rect x="0" y="0" width="${SCENE_W}" height="${SCENE_H}" fill="#1c1712"/>` +
  stack(6, 5, 18) +
  stack(106, 9, 22) +
  `<rect x="0" y="${GROUND}" width="${SCENE_W}" height="${SCENE_H - GROUND}" fill="#241c16"/>` +
  `<rect x="0" y="${GROUND}" width="${SCENE_W}" height="1" fill="#9a4f36"/>` +
  // Pam at half a scene unit per art pixel (4 px per art pixel), in the first gap.
  `<g transform="translate(52 3) scale(0.5)">${rects(agentGrid({ wing: 1, gaze: 'right' }))}</g>`;
const S = 8;
const social = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;overflow:hidden;background:#15110e;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#efe4d3}
  .glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%, rgba(217,119,87,.16), transparent 60%)}
  .frame{position:absolute;inset:36px;border:3px solid #3a2d23;border-radius:34px;box-shadow:inset 0 0 0 10px #241c16}
  .eyebrow{position:absolute;top:84px;left:0;right:0;text-align:center;font-size:20px;letter-spacing:.32em;color:#9b8b78;text-transform:uppercase}
  h1{position:absolute;top:116px;left:0;right:0;margin:0;text-align:center;font-size:96px;font-weight:800;letter-spacing:.14em;color:#d97757;text-shadow:5px 5px 0 #9a4f36,0 0 36px rgba(217,119,87,.45);text-transform:uppercase}
  .tag{position:absolute;top:248px;left:0;right:0;text-align:center;font-size:30px;letter-spacing:.06em;color:#f3e6cf}
  .scene{position:absolute;left:50%;top:312px;transform:translateX(-50%);width:${SCENE_W * S}px;height:${SCENE_H * S}px;border-radius:10px;overflow:hidden;box-shadow:0 0 0 3px #0d0a08,0 0 24px rgba(217,119,87,.12)}
  .scene svg{display:block;width:100%;height:100%;image-rendering:pixelated}
  .foot{position:absolute;bottom:64px;left:0;right:0;text-align:center;font-size:20px;letter-spacing:.18em;color:#9b8b78;text-transform:uppercase}
</style></head><body>
  <div class="glow"></div><div class="frame"></div>
  <div class="eyebrow">Flappy-style retro fan game</div>
  <h1>Claude Glide</h1>
  <div class="tag">Tap to flap. Thread the gaps. Beat your best.</div>
  <div class="scene">${svgDoc(SCENE_W, SCENE_H, scene)}</div>
  <div class="foot">Unofficial fan game · Built by Cyber Squad Zero + Claude</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(social);
await page.screenshot({ path: join(out, previewName), clip: { x: 0, y: 0, width: 1200, height: 630 } });

async function pngFromSvg(svg, size, file, transparent) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:${transparent ? 'transparent' : '#241c16'}}img{display:block;width:${size}px;height:${size}px;image-rendering:pixelated}</style></head><body><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
  await page.screenshot({ path: join(out, file), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}
await pngFromSvg(iconOpaque, 180, 'apple-touch-icon.png', false);
await pngFromSvg(iconOpaque, 192, 'icon-192.png', false);
await pngFromSvg(iconOpaque, 512, 'icon-512.png', false);
await browser.close();

console.log('assets written (favicons left as committed)');
