// Generates the app icons with no dependencies: node icons/make-icons.mjs
// Draws a purple gradient tile with a white microphone using signed distance
// functions (anti-aliased), then writes PNGs with a tiny PNG encoder (zlib).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// ---- PNG encoder ----
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- shapes (unit space 0..1) ----
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const sdCapsuleV = (x, y, cx, y1, y2, r) => { const py = Math.max(y1, Math.min(y2, y)); return Math.hypot(x - cx, y - py) - r; };
// Lower half ring (the mic holder arc).
const sdArc = (x, y, cx, cy, R, w) => {
  const d = Math.abs(Math.hypot(x - cx, y - cy) - R) - w;
  if (y >= cy) return d;
  // cap ends at the horizontal line
  const ex = Math.hypot(x - (cx - R), y - cy) - w, ex2 = Math.hypot(x - (cx + R), y - cy) - w;
  return Math.min(ex, ex2);
};

function micDist(x, y, s, ox, oy) {
  // s = scale of the glyph inside the tile, centered at (ox, oy)
  const u = (x - ox) / s + 0.5, v = (y - oy) / s + 0.5;
  const head = sdCapsuleV(u, v, 0.5, 0.2, 0.44, 0.15);
  const arc = sdArc(u, v, 0.5, 0.44, 0.27, 0.045);
  const stem = sdRoundRect(u, v, 0.5, 0.8, 0.045, 0.09, 0.03);
  const base = sdRoundRect(u, v, 0.5, 0.89, 0.18, 0.045, 0.045);
  return Math.min(head, arc, stem, base) * s;
}

function render(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 3; // supersampling per axis
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const x = (px + (sx + 0.5) / ss) / size, y = (py + (sy + 0.5) / ss) / size;
        const inTile = maskable ? -1 : sdRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, 0.22);
        if (inTile > 0) continue;
        // background gradient #8A63FF -> #5A2BE0 (top to bottom) with a soft highlight
        const t = y;
        let cr = 0x8a + (0x5a - 0x8a) * t, cg = 0x63 + (0x2b - 0x63) * t, cb = 0xff + (0xe0 - 0xff) * t;
        const hl = Math.max(0, 1 - Math.hypot(x - 0.3, y - 0.18) / 0.55) * 0.18;
        cr += (255 - cr) * hl; cg += (255 - cg) * hl; cb += (255 - cb) * hl;
        const glyph = micDist(x, y, maskable ? 0.5 : 0.62, 0.5, 0.52);
        if (glyph < 0) { cr = 255; cg = 255; cb = 255; }
        // gold dot (spark)
        const dot = Math.hypot(x - (maskable ? 0.69 : 0.74), y - (maskable ? 0.3 : 0.26)) - (maskable ? 0.045 : 0.055);
        if (dot < 0) { cr = 0xff; cg = 0xb0; cb = 0x20; }
        r += cr; g += cg; b += cb; a += 255;
      }
      const n = ss * ss, i = (py * size + px) * 4;
      if (a) { buf[i] = r / (a / 255); buf[i + 1] = g / (a / 255); buf[i + 2] = b / (a / 255); }
      buf[i + 3] = a / n;
    }
  }
  return png(size, size, buf);
}

writeFileSync(join(here, 'icon-192.png'), render(192, { maskable: false }));
writeFileSync(join(here, 'icon-512.png'), render(512, { maskable: false }));
writeFileSync(join(here, 'icon-maskable-512.png'), render(512, { maskable: true }));
writeFileSync(join(here, 'icon-maskable-192.png'), render(192, { maskable: true }));
console.log('icons written to', here);
