import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { extname } from 'path';
import { AppException } from '../../common/app-exception';

export interface StoredFileMeta {
  key: string;
  url: string;
}

/**
 * Media storage abstraction (ТЗ §41).
 * Бэкенды: local (dev — папка MEDIA_ROOT, отдаётся static-раздачей API) и
 * s3 (presigned PUT / SigV4 без тяжёлых зависимостей).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  get driver(): 'local' | 's3' | 'none' {
    if (this.config.get<string>('STORAGE_DRIVER') === 's3' && this.config.get('S3_BUCKET')) {
      return 's3';
    }
    if (this.config.get('MEDIA_ROOT')) return 'local';
    return 'none';
  }

  private localPublicUrl(key: string): string {
    const base = this.config.get<string>('MEDIA_PUBLIC_URL') ?? '';
    return `${base.replace(/\/+$/, '')}/media/${key}`;
  }

  buildKey(filename: string, mime: string): string {
    const ext = extname(filename).slice(1).toLowerCase();
    const safeExt = /^[a-z0-9]{2,5}$/.test(ext) ? ext : (mime.split('/')[1]?.split('+')[0] ?? 'bin');
    const now = new Date();
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `tour-media/${ym}/${randomBytes(12).toString('hex')}.${safeExt}`;
  }

  /** Сохранить буфер; вернуть key + публичный url. */
  async put(key: string, body: Buffer, contentType: string): Promise<StoredFileMeta> {
    const driver = this.driver;
    if (driver === 'local') {
      const fs = await import('fs/promises');
      const path = await import('path');
      const root = path.resolve(this.config.get<string>('MEDIA_ROOT')!);
      const abs = path.resolve(root, key);
      if (!abs.startsWith(root + path.sep)) throw AppException.validation('Некорректный ключ файла');
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, body);
      return { key, url: this.localPublicUrl(key) };
    }
    if (driver === 's3') return this.s3Put(key, body, contentType);
    throw new AppException('STORAGE_UNAVAILABLE', 'Хранилище файлов не настроено', 503);
  }

  publicUrl(key: string): string {
    if (this.driver === 'local') return this.localPublicUrl(key);
    const c = this.s3Creds();
    if (c.endpoint) {
      const u = new URL(c.endpoint);
      const prefix = u.pathname === '/' ? `/${c.bucket}` : `${u.pathname}/${c.bucket}`;
      const scheme = c.endpoint.startsWith('http://') ? 'http' : 'https';
      return `${scheme}://${u.host}${prefix}/${key}`;
    }
    return `https://${c.bucket}.s3.${c.region}.amazonaws.com/${key}`;
  }

  /** Presigned PUT для прямой загрузки из браузера в S3 (ТЗ §41). */
  presignPut(key: string, contentType: string): { url: string; method: 'PUT'; expiresIn: number; headers: Record<string, string> } {
    if (this.driver !== 's3') {
      throw new AppException('STORAGE_UNAVAILABLE', 'Presigned-загрузка доступна только для S3-бэкенда', 503);
    }
    const expires = 600;
    void contentType;
    return { url: this.s3SignedUrl('PUT', key, expires), method: 'PUT', expiresIn: expires, headers: { 'content-type': contentType } };
  }

  async remove(key: string): Promise<void> {
    if (this.driver === 'local') {
      const fs = await import('fs/promises');
      const path = await import('path');
      const abs = path.resolve(path.resolve(this.config.get<string>('MEDIA_ROOT')!), key);
      try {
        await fs.unlink(abs);
      } catch {
        /* уже удалён — не ошибка */
      }
      return;
    }
    if (this.driver === 's3') {
      await fetch(this.s3SignedUrl('DELETE', key, 60), { method: 'DELETE' }).catch(() => undefined);
    }
  }

  // ---------- минимальный AWS SigV4 (без aws-sdk) ----------

  private s3Creds() {
    return {
      accessKeyId: this.config.get<string>('S3_ACCESS_KEY') ?? '',
      secretAccessKey: this.config.get<string>('S3_SECRET_KEY') ?? '',
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      bucket: this.config.get<string>('S3_BUCKET') ?? '',
      endpoint: (this.config.get<string>('S3_ENDPOINT') ?? '').replace(/\/+$/, ''),
    };
  }

  private s3Target(): { scheme: string; host: string; pathPrefix: string } {
    const c = this.s3Creds();
    if (c.endpoint) {
      const u = new URL(c.endpoint);
      return {
        scheme: c.endpoint.startsWith('http://') ? 'http' : 'https',
        host: u.host,
        pathPrefix: u.pathname === '/' ? `/${c.bucket}` : `${u.pathname}/${c.bucket}`,
      };
    }
    return { scheme: 'https', host: `${c.bucket}.s3.${c.region}.amazonaws.com`, pathPrefix: '' };
  }

  private async s3Put(key: string, body: Buffer, contentType: string): Promise<StoredFileMeta> {
    const c = this.s3Creds();
    const t = this.s3Target();
    const uri = `${t.scheme}://${t.host}${t.pathPrefix}/${key}`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const sha = createHash('sha256').update(body).digest('hex');
    const headers: Record<string, string> = {
      'content-type': contentType,
      'x-amz-content-sha256': sha,
      'x-amz-date': amzDate,
      host: t.host,
    };
    const { signedHeaders, signature, scope } = this.sign('PUT', uri, headers, sha, amzDate, c);
    headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const res = await fetch(uri, { method: 'PUT', headers, body });
    if (!res.ok) {
      this.logger.error(`S3 PUT ${key}: ${res.status}`);
      throw new AppException('STORAGE_UNAVAILABLE', 'Не удалось сохранить файл в хранилище', 502);
    }
    return { key, url: this.publicUrl(key) };
  }

  private s3SignedUrl(method: string, key: string, expires: number): string {
    const c = this.s3Creds();
    const t = this.s3Target();
    const uri = `${t.scheme}://${t.host}${t.pathPrefix}/${key}`;
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${c.region}/s3/aws4_request`;
    const qs = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(`${c.accessKeyId}/${scope}`)}`,
      `X-Amz-Date=${amzDate}`,
      `X-Amz-Expires=${expires}`,
      `X-Amz-SignedHeaders=host`,
    ].join('&');
    const canonical = `${method}\n${encodeURI(t.pathPrefix + '/' + key)}\n${qs}\nhost:${t.host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
    const signature = createHmac('sha256', this.deriveKey(c.secretAccessKey, dateStamp, c.region, 's3')).update(stringToSign).digest('hex');
    return `${uri}?${qs}&X-Amz-Signature=${signature}`;
  }

  private sign(
    method: string,
    uri: string,
    headers: Record<string, string>,
    payloadHash: string,
    amzDate: string,
    c: ReturnType<StorageService['s3Creds']>,
  ): { signedHeaders: string; signature: string; scope: string } {
    const u = new URL(uri);
    const keys = Object.keys(headers).sort();
    const canonicalHeaders = keys.map((k) => `${k}:${headers[k]!.trim()}`).join('\n') + '\n';
    const signedHeaders = keys.join(';');
    const canonical = `${method}\n${decodeURIComponent(u.pathname)}\n${u.searchParams.toString()}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${c.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash('sha256').update(canonical).digest('hex')}`;
    const signature = createHmac('sha256', this.deriveKey(c.secretAccessKey, dateStamp, c.region, 's3')).update(stringToSign).digest('hex');
    return { signedHeaders, signature, scope };
  }

  private deriveKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${secret}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(region).digest();
    const kService = createHmac('sha256', kRegion).update(service).digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  /** HMAC-проверка токена (задел под внешние post-загрузки). */
  verifyToken(token: string, secret: string): boolean {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
