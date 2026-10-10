import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export const PASSENGER_TYPES = { ADULT: 'ADULT', CHILD_10_TO_14: 'CHILD_10_TO_14', CHILD_UNDER_10: 'CHILD_UNDER_10' } as const;
export const BOOKING_SOURCES = { WEBSITE: 'WEBSITE', TELEGRAM: 'TELEGRAM', TG_BOT: 'TG_BOT', PHONE: 'PHONE', MANAGER: 'MANAGER', OTHER: 'OTHER' } as const;
export const BOOKING_TARGET_STATUSES = {
  CONTACTED: 'CONTACTED',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
} as const;

export class PassengerDto {
  @ApiProperty() @IsString() @MaxLength(100) firstName!: string;
  @ApiProperty() @IsString() @MaxLength(100) lastName!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(100) middleName?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() birthDate?: string;
  @ApiProperty({ enum: Object.values(PASSENGER_TYPES) }) @IsEnum(PASSENGER_TYPES) passengerType!: keyof typeof PASSENGER_TYPES;
  @ApiProperty({ required: false }) @IsString() @IsOptional() phone?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(500) comment?: string;
}

export class BookingCustomerDto {
  @ApiProperty() @IsString() @MaxLength(100) firstName!: string;
  @ApiProperty() @IsString() @MaxLength(100) lastName!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(100) middleName?: string;
  @ApiProperty() @IsString() @Matches(/^\+?[0-9\s\-()]{7,20}$/, { message: 'Укажите корректный телефон' }) phone!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() email?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() telegramUsername?: string;
}

export class CreateBookingDto {
  @ApiProperty() @IsString() departureId!: string;
  @ApiProperty() @IsString() departureCityId!: string;
  @ApiProperty({ type: BookingCustomerDto }) @ValidateNested() @Type(() => BookingCustomerDto) customer!: BookingCustomerDto;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) adults!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) children10to14!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) childrenUnder10!: number;
  @ApiProperty({ type: [PassengerDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PassengerDto) passengers!: PassengerDto[];
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(1000) comment?: string;
  @ApiProperty({ required: false, enum: Object.values(BOOKING_SOURCES) }) @IsEnum(BOOKING_SOURCES) @IsOptional() source?: keyof typeof BOOKING_SOURCES;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(100) idempotencyKey?: string;
  // totalAmount намеренно отсутствует в DTO — сумма считается только на сервере (ТЗ §17)
}

export class ChangeBookingStatusDto {
  @ApiProperty({ enum: Object.values(BOOKING_TARGET_STATUSES) }) @IsEnum(BOOKING_TARGET_STATUSES) status!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(500) note?: string;
}
