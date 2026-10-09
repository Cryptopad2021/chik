import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

/** Файл в memory storage (multer без diskStorage) — типизация локально, т.к. Nest не экспортирует готовый тип. */
interface MemoryStorageFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/constants';
import { MediaService } from './media.service';
import { RegisterFileDto, AltDto, PresignDto } from './dto';

@ApiTags('media')
@Controller('api/media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly svc: MediaService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Библиотека файлов (media:upload)' })
  async list(@Query('page') page?: string, @Query('perPage') perPage?: string) {
    return { success: true, data: await this.svc.list(Number(page) || 1, Number(perPage) || 24) };
  }

  @Post('upload')
  @RequirePermissions(PERMISSIONS.MEDIA_UPLOAD)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Загрузить изображение (jpeg/png/webp/gif ≤10MB, media:upload)' })
  async upload(@UploadedFile() file: MemoryStorageFile, @CurrentUser() user: AuthUser) {
    return { success: true, data: await this.svc.uploadImage(file, user.id) };
  }

  @Post('presign')
  @RequirePermissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Presigned PUT для прямой загрузки в S3 (S3-бэкенд)' })
  presign(@Body() dto: PresignDto) {
    return { success: true, data: this.svc.presign(dto.filename, dto.contentType) };
  }

  @Post()
  @RequirePermissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Зарегистрировать уже загруженный по presigned URL файл' })
  async register(@Body() dto: RegisterFileDto, @CurrentUser() user: AuthUser) {
    return { success: true, data: await this.svc.registerExternal(dto, user.id) };
  }

  @Patch(':id/alt')
  @RequirePermissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Обновить alt-текст файла (§44 доступность)' })
  async alt(@Param('id') id: string, @Body() dto: AltDto, @CurrentUser() user: AuthUser) {
    return { success: true, data: await this.svc.setAlt(id, dto.alt ?? null, user.id) };
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.MEDIA_UPLOAD)
  @ApiOperation({ summary: 'Удалить файл из библиотеки' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { success: true, data: await this.svc.remove(id, user.id) };
  }
}
