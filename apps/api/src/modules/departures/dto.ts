import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const DEPARTURE_STATUSES = {
  OPEN: 'OPEN',
  ALMOST_FULL: 'ALMOST_FULL',
  FULL: 'FULL',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
} as const;
export type DepartureStatusValue =
  (typeof DEPARTURE_STATUSES)[keyof typeof DEPARTURE_STATUSES];

export class DepartureCityDto {
  @ApiProperty() @IsString() departureCityId!: string;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() price?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(500) notes?: string;
}

export class CreateDepartureDto {
  @ApiProperty() @IsString() tourId!: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiProperty() @IsInt() @Min(1) totalSeats!: number;
  @ApiProperty() @IsNumber() @Min(0) price!: number;
  @ApiProperty({ required: false, enum: Object.values(DEPARTURE_STATUSES) })
  @IsEnum(DEPARTURE_STATUSES)
  @IsOptional()
  status?: DepartureStatusValue;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(1000) notes?: string;
  @ApiProperty({ required: false, type: [DepartureCityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartureCityDto)
  @IsOptional()
  cities?: DepartureCityDto[];
}

export class UpdateDepartureDto {
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() startDate?: string;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() endDate?: string;
  @ApiProperty({ required: false }) @IsInt() @Min(0) @IsOptional() totalSeats?: number;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() price?: number;
  @ApiProperty({ required: false, enum: Object.values(DEPARTURE_STATUSES) })
  @IsEnum(DEPARTURE_STATUSES)
  @IsOptional()
  status?: DepartureStatusValue;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(1000) notes?: string;
  @ApiProperty({ required: false, type: [DepartureCityDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartureCityDto)
  @IsOptional()
  cities?: DepartureCityDto[];
}

export class ListDeparturesQuery {
  @ApiProperty({ required: false }) @IsString() @IsOptional() tourId?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() citySlug?: string;
  @ApiProperty({ required: false, enum: Object.values(DEPARTURE_STATUSES) })
  @IsEnum(DEPARTURE_STATUSES)
  @IsOptional()
  status?: DepartureStatusValue;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() dateFrom?: string;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() dateTo?: string;
  @ApiProperty({ required: false, default: 'false' })
  @IsEnum({ true: 'true', false: 'false' })
  @IsOptional()
  upcomingOnly?: 'true' | 'false';
}
