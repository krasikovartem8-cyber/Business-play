// Генерирует PNG-иконки для PWA «Своё дело» без внешних зависимостей (чистый Node: zlib + CRC32).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, pixel) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + .5, y + .5);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = v => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = clamp01((vx * wx + vy * wy) / (vx * vx + vy * vy));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
};

function makeDeloIcon(size) {
  // Тёмный фон, золотые столбики роста и белая линия тренда
  const u = size / 512;
  const bars = [[96, 304, 64, 112], [184, 248, 64, 168], [272, 184, 64, 232], [360, 104, 64, 312]].map(b => b.map(v => v * u));
  const line = [[110, 250], [210, 190], [290, 220], [400, 110]].map(p => p.map(v => v * u));
  const lw = 22 * u, r = 14 * u;
  const rrDist = (x, y, bx, by, bw, bh) => {
    const qx = Math.abs(x - (bx + bw / 2)) - (bw / 2 - r), qy = Math.abs(y - (by + bh / 2)) - (bh / 2 - r);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  };
  return png(size, (x, y) => {
    const t = (x + y) / (2 * size);
    let col = mix([27, 31, 69], [11, 13, 26], t);
    let bar = 0, barT = 0;
    for (const [bx, by, bw, bh] of bars) { const d = rrDist(x, y, bx, by, bw, bh); const a = clamp01(-d + 1); if (a > bar) { bar = a; barT = (x - bx + y - by) / (bw + bh); } }
    col = mix(col, mix([255, 209, 102], [255, 177, 122], clamp01(barT)), bar);
    let d = Infinity;
    for (let i = 0; i < line.length - 1; i++) d = Math.min(d, segDist(x, y, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]));
    d = Math.min(d, Math.hypot(x - line[3][0], y - line[3][1]) - 11 * u);
    col = mix(col, [255, 255, 255], clamp01(lw / 2 - d + 1));
    return [Math.round(col[0]), Math.round(col[1]), Math.round(col[2]), 255];
  });
}

const out = join(root, 'icons');
mkdirSync(out, { recursive: true });
for (const s of [192, 512]) {
  writeFileSync(join(out, `icon-${s}.png`), makeDeloIcon(s));
  console.log(`icons/icon-${s}.png`);
}
