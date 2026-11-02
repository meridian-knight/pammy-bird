// Generates the home-screen icons (apple-touch 180, icon-192, icon-512) and the
// 1200x630 social preview from the same 32x32 Pam grid the game draws
// (src/art/agent-grid.js). The favicons (favicon.svg, favicon.ico,
// favicon-16.png, favicon-32.png) are a hand-drawn 16px Pam matching A5a, committed in
// public/ as delivered: this script does not write them, because a 32px sprite
// downscaled to 16px loses Pam's features.
// The social preview is laid out like Claude Glide's: the title block centred and
// a large Pam alone at a whole number of px per art pixel (no game frame), so no
// dev server is needed.
// Usage: node scripts/make-assets.mjs <outDir> [previewFileName]
// Example: npm run assets   (writes into public/, preview as social-preview-v4.png)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { agentGrid, PALETTE, SPRITE_PX } from '../src/art/agent-grid.js';

const out = process.argv[2] ?? 'public';
const previewName = process.argv[3] ?? 'social-preview-v4.png';
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

// --- Social preview 1200x630, laid out like Claude Glide's: eyebrow, title and
// tagline centred, then Pam alone (wing 1, looking ahead), art rows 8-24 at exactly
// PAM_PX px per art pixel so every sprite pixel is the same size, then the footer.
const PAM_PX = 10;
const PAM_ROWS = 17; // art rows 8-24 hold every state
const bigPam = svgDoc(SPRITE_PX, PAM_ROWS, `<g transform="translate(0 -8)">${rects(agentGrid({ wing: 1, gaze: 'right' }))}</g>`);
const social = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0e0d18;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#efe4d3}
  .glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%, rgba(252,196,28,.12), transparent 60%)}
  .frame{position:absolute;inset:36px;border:3px solid #2e2b4a;border-radius:34px;box-shadow:inset 0 0 0 10px #1c1a2e}
  .eyebrow{position:absolute;top:84px;left:0;right:0;text-align:center;font-size:20px;letter-spacing:.32em;color:#8f8ba6;text-transform:uppercase}
  h1{position:absolute;top:116px;left:0;right:0;margin:0;text-align:center;font-size:96px;font-weight:800;letter-spacing:.14em;color:#fcc41c;text-shadow:5px 5px 0 #b8460c,0 0 36px rgba(252,196,28,.35);text-transform:uppercase}
  .tag{position:absolute;top:248px;left:0;right:0;text-align:center;font-size:30px;letter-spacing:.06em;color:#f3e6cf}
  .pam{position:absolute;left:${(1200 - SPRITE_PX * PAM_PX) / 2}px;top:${312 + (200 - PAM_ROWS * PAM_PX) / 2}px;width:${SPRITE_PX * PAM_PX}px;height:${PAM_ROWS * PAM_PX}px}
  .pam svg{display:block;width:100%;height:100%;image-rendering:pixelated}
  .foot{position:absolute;bottom:64px;left:0;right:0;text-align:center;font-size:20px;letter-spacing:.18em;color:#8f8ba6;text-transform:uppercase}
</style></head><body>
  <div class="glow"></div><div class="frame"></div>
  <div class="eyebrow">Flappy-style retro fan game</div>
  <h1>Pammy Bird</h1>
  <div class="tag">Tap to flap. Thread the gaps. Beat your best.</div>
  <div class="pam">${bigPam}</div>
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
