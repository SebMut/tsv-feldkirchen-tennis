// Build-time PNG icons for browsers that require 192x192 and 512x512 PNGs
// to install a Progressive Web App. Does not run in the browser.
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let i = 0; i < 8; i++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const code = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([code, data])));
  return Buffer.concat([length, code, data, crc]);
}
const glyphs: Record<string, string[]> = {
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  V: ['10001','10001','10001','10001','01010','01010','00100'],
};

export function renderIconPng(size: 192 | 512): Buffer {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const scale = size / 512;
  const ink = (x: number, y: number): [number, number, number] => {
    const rr = 78, cornerX = Math.max(0, Math.abs(x - 256) - (239 - rr));
    const cornerY = Math.max(0, Math.abs(y - 256) - (239 - rr));
    const inside = cornerX * cornerX + cornerY * cornerY <= rr * rr;
    if (!inside) return [255, 255, 255];
    const dx = x - 256, dy = y - 207;
    const radius = Math.sqrt(dx*dx + dy*dy);
    if (radius < 125) {
      // Bright tennis ball with white curved seam lines
      const seamL = Math.abs(dx - (66*Math.sin((y-207)/100)-58));
      const seamR = Math.abs(dx - (66*Math.sin((y-207)/100)+58));
      if (seamL < 7 || seamR < 7) return [255,255,255];
      return [220,241,111];
    }
    if (Math.abs(x-256) < 161 && y >= 377 && y <= 461) {
      const br = 16, cx = Math.max(0,Math.abs(x-256)-(161-br));
      const cy = Math.max(0,Math.abs(y-419)-(42-br));
      if (cx*cx+cy*cy<=br*br) {
        const textStart=169, textTop=388, pixel=10, spacing=12;
        for (const [i,letter] of ['T','S','V'].entries()) {
          const rows=glyphs[letter];
          const localX=x-(textStart+i*(5*pixel+spacing));
          const localY=y-textTop;
          const col=Math.floor(localX/pixel), row=Math.floor(localY/pixel);
          if (row>=0 && row<7 && col>=0 && col<5 && rows[row][col]==='1') return [227,6,19];
        }
        return [255,255,255];
      }
    }
    return [227,6,19];
  };
  for (let iy=0; iy<size; iy++) {
    const stride = size*4+1;
    raw[iy*stride]=0;
    for (let ix=0; ix<size; ix++) {
      const [r,g,b] = ink((ix+0.5)/scale, (iy+0.5)/scale);
      const pos=iy*stride+1+ix*4;
      raw[pos]=r; raw[pos+1]=g; raw[pos+2]=b; raw[pos+3]=255;
    }
  }
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(size,0); ihdr.writeUInt32BE(size,4);
  ihdr[8]=8; ihdr[9]=6; // RGBA / 8bit
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr),
    chunk('IDAT',deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0)),
  ]);
}
