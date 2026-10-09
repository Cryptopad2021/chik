import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/app-exception';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage.service';
import { probeImage, sniffImageMime } from './image-probe';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB (ТЗ §41)

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private get db() {
    if (!this.prisma.isHealthy()) throw AppException.databaseUnavailable();
    return this.prisma;
  }

  /** Загрузка изображения: sniff по байтам → storage.put → запись File (§41). */
  async uploadImage(file: { filename?: string; mimetype?: string; buffer?: Buffer }, userId: string) {
    const buf = file?.buffer;
    if (!buf || buf.length === 0) throw AppException.validation('Пустой файл');
    if (buf.length > MAX_SIZE) {
      throw new AppException('FILE_TOO_LARGE', 'Файл больше 10 МБ', 413);
    }
    const mime = sniffImageMime(buf);
    if (!mime) {
      throw new AppException('INVALID_IMAGE', 'Можно загружать только JPEG/PNG/WebP/GIF', 400);
    }
    const dims = probeImage(buf);
    const key = this.storage.buildKey(file.filename ?? 'image', mime);
    const stored = await this.storage.put(key, buf, mime);
    const row = await this.db.file.create({
      data: {
        filename: file.filename ?? key.split('/').pop()!,
        mimeType: mime,
        size: buf.length,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        url: stored.url,
        alt: null,
        key: stored.key,
        uploadedBy: userId,
      },
    });
    await this.audit.log({ userId, action: 'MEDIA_UPLOADED', entity: 'File', entityId: row.id, metadata: { key: row.key, size: row.size } });
    return row;
  }

  /** Метаданные без бинарника (для presigned-потока: клиент сам положил файл в S3). */
  async registerExternal(input: { key: string; url: string; filename: string; mimeType: string; size: number; width?: number; height?: number; alt?: string }, userId: string) {
    const row = await this.db.file.create({
      data: {
        key: input.key,
        url: input.url,
        filename: input.filename,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width ?? null,
        height: input.height ?? null,
        alt: input.alt ?? null,
        uploadedBy: userId,
      } as Prisma.FileCreateInput,
    });
    await this.audit.log({ userId, action: 'MEDIA_REGISTERED', entity: 'File', entityId: row.id, metadata: { key: row.key } });
    return row;
  }

  async list(page = 1, perPage = 24) {
    const p = Math.max(1, page);
    const n = Math.min(100, Math.max(1, perPage));
    const [items, total] = await Promise.all([
      this.db.file.findMany({ orderBy: { createdAt: 'desc' }, skip: (p - 1) * n, take: n }),
      this.db.file.count(),
    ]);
    return { items, total, page: p, perPage: n, totalPages: Math.ceil(total / n) };
  }

  async byId(id: string) {
    const f = await this.db.file.findUnique({ where: { id } });
    if (!f) throw new AppException('FILE_NOT_FOUND', 'Файл не найден', 404);
    return f;
  }

  async setAlt(id: string, alt: string | null, userId: string) {
    await this.byId(id);
    const f = await this.db.file.update({ where: { id }, data: { alt } });
    await this.audit.log({ userId, action: 'MEDIA_ALT_UPDATED', entity: 'File', entityId: id });
    return f;
  }

  /** Удаление из библиотеки. Туры, ссылающиеся на файл, отвязываются (url остаётся в TourImage). */
  async remove(id: string, userId: string) {
    const f = await this.byId(id);
    await this.db.tourImage.updateMany({ where: { fileId: id }, data: { fileId: null } });
    await this.db.file.delete({ where: { id } });
    await this.storage.remove(f.key).catch(() => undefined);
    await this.audit.log({ userId, action: 'MEDIA_DELETED', entity: 'File', entityId: id, metadata: { key: f.key } });
    return { id, deleted: true };
  }

  presign(filename: string, contentType: string) {
    const key = this.storage.buildKey(filename, contentType);
    const signed = this.storage.presignPut(key, contentType);
    return { key, ...signed };
  }
}
