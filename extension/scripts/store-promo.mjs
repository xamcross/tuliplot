import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// One-off: render Chrome Web Store promo tiles (small 440x280, marquee 1400x560)
// from the TulipLot design system via headless Edge/Chrome.
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'store-assets');
const srcDir = path.join(outDir, 'src');
fs.mkdirSync(srcDir, { recursive: true });

const FONTS = path.join(here, '..', '..', 'frontend', 'node_modules', '@fontsource');
const b64 = (p) => fs.readFileSync(p).toString('base64');
const face = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64(file)}) format('woff2')}`;

const fontCss =
  face('Space Grotesk', 700, path.join(FONTS, 'space-grotesk/files/space-grotesk-latin-700-normal.woff2')) +
  face('DM Sans', 400, path.join(FONTS, 'dm-sans/files/dm-sans-latin-400-normal.woff2')) +
  face('Space Mono', 700, path.join(FONTS, 'space-mono/files/space-mono-latin-700-normal.woff2'));

const squares = (s, r, g) => `
  <span style="display:inline-grid;grid-template-columns:${s}px ${s}px;gap:${g}px;">
    <i style="width:${s}px;height:${s}px;border-radius:${r}px;background:#FFB1B1"></i>
    <i style="width:${s}px;height:${s}px;border-radius:${r}px;background:#FFD8A8"></i>
    <i style="width:${s}px;height:${s}px;border-radius:${r}px;background:#A5D8FF"></i>
    <i style="width:${s}px;height:${s}px;border-radius:${r}px;background:#B2F2BB"></i>
  </span>`;

const pill = (fz, pad) => `
  <span style="font-family:'Space Mono';font-weight:700;font-size:${fz}px;letter-spacing:.1em;
    color:#7FB4FF;background:rgba(77,150,255,.16);border-radius:999px;padding:${pad};">CHROME COMPANION</span>`;

const base = (w, h, body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontCss}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${w}px;height:${h}px;overflow:hidden;
    background:linear-gradient(135deg,#232048,#2A2358);color:#EDEBF7;font-family:'DM Sans'}
</style></head><body>${body}</body></html>`;

const cell = (dot, extra = '') => `
  <div style="background:#232040;border:1px solid #363258;border-radius:10px;padding:12px;height:104px;">
    <div style="display:flex;gap:7px;align-items:center;margin-bottom:9px;">
      <i style="width:8px;height:8px;border-radius:50%;background:${dot};display:inline-block"></i>
      <i style="width:44px;height:6px;border-radius:3px;background:#A9A4C4;display:inline-block"></i>
    </div>
    <div style="width:82%;height:5px;border-radius:3px;background:#363258;margin-bottom:6px;"></div>
    <div style="width:60%;height:5px;border-radius:3px;background:#363258;"></div>${extra}
  </div>`;

const enableCell = `
  <div style="background:#232040;border:1px solid #363258;border-radius:10px;height:104px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;">
    <span style="font-size:10px;color:#A9A4C4;">Needs the Companion</span>
    <span style="background:#4D96FF;color:#fff;font-size:11px;font-weight:500;border-radius:999px;
      padding:6px 14px;box-shadow:0 6px 14px rgba(77,150,255,.22);">Enable for this site</span>
  </div>`;

const adCell = `
  <div style="background:rgba(208,191,255,.10);border:1px dashed #54487e;border-radius:10px;height:104px;
    display:flex;align-items:center;justify-content:center;">
    <span style="font-family:'Space Mono';font-weight:700;font-size:9px;letter-spacing:.09em;color:#D0BFFF;">UPGRADE</span>
  </div>`;

const small = base(440, 280, `
  <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;">
    <div style="display:flex;align-items:center;gap:13px;">
      ${squares(19, 6, 4)}
      <span style="font-family:'Space Grotesk';font-weight:700;font-size:46px;">TulipLot</span>
    </div>
    <div style="font-size:16px;color:#A9A4C4;">Your apps on one calm screen.</div>
    ${pill(10, '5px 13px')}
  </div>`);

const marquee = base(1400, 560, `
  <div style="height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 90px;">
    <div style="display:flex;flex-direction:column;gap:22px;max-width:560px;">
      <div style="display:flex;align-items:center;gap:15px;">
        ${squares(24, 8, 5)}
        <span style="font-family:'Space Grotesk';font-weight:700;font-size:58px;">TulipLot</span>
      </div>
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:34px;line-height:1.15;">
        Your apps on one calm screen.</div>
      <div style="font-size:18px;line-height:1.5;color:#A9A4C4;">
        The Companion unlocks the sites that refuse to load in your grid —<br>per site, only when you ask.</div>
      <div>${pill(12, '7px 16px')}</div>
    </div>
    <div style="width:560px;background:#1A1830;border:1px solid #2E2B4E;border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">${squares(8, 2, 2)}
          <span style="font-family:'Space Grotesk';font-weight:700;font-size:14px;">TulipLot</span></div>
        <span style="background:#4D96FF;color:#fff;font-size:10px;font-weight:500;border-radius:999px;padding:4px 11px;">+ Add app</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
        ${cell('#A5D8FF')}${cell('#B2F2BB')}${enableCell}
        ${cell('#FFD8A8')}${cell('#FFB1B1')}${adCell}
      </div>
    </div>
  </div>`);

fs.writeFileSync(path.join(srcDir, 'promo-small.html'), small);
fs.writeFileSync(path.join(srcDir, 'promo-marquee.html'), marquee);

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-promo-'));

async function render(name, w, h, out) {
  const shot = path.join(srcDir, `${name}-raw.png`);
  execFileSync(EDGE, [
    '--headless', '--disable-gpu', `--screenshot=${shot}`,
    `--window-size=${w},${h}`, '--force-device-scale-factor=2', '--hide-scrollbars',
    `--user-data-dir=${tmpProfile}`, `file:///${path.join(srcDir, name + '.html').replace(/\\/g, '/')}`,
  ], { stdio: 'ignore', timeout: 60000 });
  await sharp(shot).resize(w, h, { fit: 'fill' }).removeAlpha().png().toFile(path.join(outDir, out));
  const m = await sharp(path.join(outDir, out)).metadata();
  console.log(out, `${m.width}x${m.height}`, m.format, 'alpha:' + m.hasAlpha);
}

await render('promo-small', 440, 280, 'promo-small-440x280.png');
await render('promo-marquee', 1400, 560, 'promo-marquee-1400x560.png');
