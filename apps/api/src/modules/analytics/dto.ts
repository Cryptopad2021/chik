import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ANALYTICS_EVENT_TYPES } from './analytics.constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TrackEventDto {
  @ApiProperty({ enum: ANALYTICS_EVENT_TYPES })
  @IsIn(ANALYTICS_EVENT_TYPES)
  type!: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() @Matches(UUID_RE, { message: 'tourId должен быть UUID' }) tourId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @Matches(UUID_RE, { message: 'departureId должен быть UUID' }) departureId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @Matches(UUID_RE, { message: 'bookingId должен быть UUID' }) bookingId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(64) sessionId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(64) utmSource?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(64) utmMedium?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(128) utmCampaign?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(500) path?: string;
  @ApiProperty({ required: false }) @IsObject() @IsOptional() metadata?: Record<string, unknown>;

  /** Внутренний источник заявки (для события booking_created). Не приходит от клиента. */
  @ApiProperty({ required: false }) @IsString() @IsOptional() source?: string;
}

export class TrackBatchDto {
  @ApiProperty({ type: [TrackEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events!: TrackEventDto[];
}
