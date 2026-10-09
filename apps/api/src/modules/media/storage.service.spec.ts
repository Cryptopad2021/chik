import { describe, it, expect } from 'vitest';
import { StorageService } from './storage.service';

function svc(values: Record<string, string>) {
  const config = { get: (k: string) => values[k] } as never;
  return new StorageService(config);
}

describe('StorageService drivers (ТЗ §41)', () => {
  it('local driver когда MEDIA_ROOT задан', () => {
    const s = svc({ MEDIA_ROOT: '/tmp/media', MEDIA_PUBLIC_URL: 'http://localhost:3001' });
    expect(s.driver).toBe('local');
    expect(s.publicUrl('tour-media/202610/abc.jpg')).toBe('http://localhost:3001/media/tour-media/202610/abc.jpg');
  });

  it('s3 driver приоритетный при STORAGE_DRIVER=s3 + bucket', () => {
    const s = svc({ STORAGE_DRIVER: 's3', S3_BUCKET: 'chirkey', S3_REGION: 'ru-1', MEDIA_ROOT: '/tmp/m' });
    expect(s.driver).toBe('s3');
    expect(s.publicUrl('k/a.png')).toBe('https://chirkey.s3.ru-1.amazonaws.com/k/a.png');
  });

  it('MinIO-style endpoint → path-style url', () => {
    const s = svc({ STORAGE_DRIVER: 's3', S3_BUCKET: 'chirkey', S3_ENDPOINT: 'http://minio.local:9000' });
    expect(s.publicUrl('k/a.png')).toBe('http://minio.local:9000/chirkey/k/a.png');
  });

  it('none без конфигурации → put бросает STORAGE_UNAVAILABLE', async () => {
    const s = svc({});
    expect(s.driver).toBe('none');
    await expect(s.put('k', Buffer.from('x'), 'image/png')).rejects.toMatchObject({
      code: 'STORAGE_UNAVAILABLE',
    });
  });

  it('buildKey: safe ext + ym prefix', () => {
    const s = svc({ MEDIA_ROOT: '/tmp/m' });
    const key = s.buildKey('Фото Дагестана.JPEG', 'image/jpeg');
    expect(key).toMatch(/^tour-media\/\d{6}\/[0-9a-f]{24}\.jpeg$/);
    const weird = s.buildKey('evil.php%00', 'image/webp');
    expect(weird.endsWith('.webp')).toBe(true);
    expect(weird.includes('php')).toBe(false);
  });
});
