import { describe, it, expect } from 'vitest';
import { probeImage, sniffImageMime } from './image-probe';

const png1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// JPEG с SOF0: width=120, height=80 (собранный вручную заголовок)
function fakeJpeg(width: number, height: number): Buffer {
  const parts: Buffer[] = [
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // APP0 marker
    Buffer.from([0x00, 0x10]), // len 16
    Buffer.from('JFIF\0', 'latin1'),
    Buffer.from([0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
    Buffer.from([0xff, 0xc0]), // SOF0
    Buffer.from([0x00, 0x11]), // len 17
    Buffer.from([0x08]), // precision
  ];
  const h = Buffer.alloc(2); h.writeUInt16BE(height);
  const w = Buffer.alloc(2); w.writeUInt16BE(width);
  parts.push(h, w, Buffer.from([0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]));
  return Buffer.concat(parts);
}

describe('image-probe (ТЗ §41)', () => {
  it('PNG: sniff + размеры', () => {
    expect(sniffImageMime(png1x1)).toBe('image/png');
    expect(probeImage(png1x1)).toEqual({ width: 1, height: 1 });
  });

  it('JPEG: размеры из SOF0', () => {
    const buf = fakeJpeg(120, 80);
    expect(sniffImageMime(buf)).toBe('image/jpeg');
    expect(probeImage(buf)).toEqual({ width: 120, height: 80 });
  });

  it('не картинка → null mime', () => {
    const exe = Buffer.from('%PDF-1.4 document trailer');
    expect(sniffImageMime(exe)).toBeNull();
  });

  it('GIF распознаётся', () => {
    const gif = Buffer.concat([
      Buffer.from('GIF89a', 'latin1'),
      (() => { const b = Buffer.alloc(4); b.writeUInt16LE(320, 0); b.writeUInt16LE(200, 2); return b; })(),
      Buffer.alloc(8),
    ]);
    expect(sniffImageMime(gif)).toBe('image/gif');
    expect(probeImage(gif)).toEqual({ width: 320, height: 200 });
  });
});
