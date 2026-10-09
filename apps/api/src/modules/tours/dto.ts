import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min, ValidateNested } from 'class-validator';

export const TOUR_STATUSES = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', ARCHIVED: 'ARCHIVED' } as const;
export type TourStatusValue = (typeof TOUR_STATUSES)[keyof typeof TOUR_STATUSES];

export class TourDayDto {
  @ApiProperty() @IsInt() @Min(1) dayNumber!: number;
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() meals?: string;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() overnight?: boolean;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() sortOrder?: number;
}

/** Программа тура целиком при create/update — перестановка replace (ТЗ §9). */
export class ReplaceTourDaysDto {
  @ApiProperty({ type: [TourDayDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourDayDto)
  days!: TourDayDto[];
}

export class TourImageDto {
  @ApiProperty() @IsUrl({ require_tld: false }) url!: string;
  /** alt обязателен для доступности (ТЗ §44) */
  @ApiProperty() @IsString() @MaxLength(300) alt!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(300) title?: string;
  @ApiProperty({ required: false }) @IsInt() @IsOptional() sortOrder?: number;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() isCover?: boolean;
  /** ссылка на запись Media Library (File.id), если загружали через /api/media */
  @ApiProperty({ required: false }) @IsString() @IsOptional() fileId?: string;
}

export class ReplaceTourImagesDto {
  @ApiProperty({ type: [TourImageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TourImageDto)
  images!: TourImageDto[];
}

export class CreateTourDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @MaxLength(500) shortDescription!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiProperty() @IsString() destinationId!: string;
  @ApiProperty() @IsInt() @Min(1) durationDays!: number;
  @ApiProperty() @IsInt() @Min(0) durationNights!: number;
  @ApiProperty() @IsNumber() @Min(0) basePrice!: number;
  @ApiProperty({ required: false, default: 'RUB' }) @IsString() @IsOptional() currency?: string;
  @ApiProperty({ required: false, enum: Object.values(TOUR_STATUSES) }) @IsEnum(TOUR_STATUSES) @IsOptional() status?: TourStatusValue;
  @ApiProperty() @IsNumber() @Min(0) adultPrice!: number;
  @ApiProperty() @IsNumber() @Min(0) child10to14Price!: number;
  @ApiProperty() @IsNumber() @Min(0) childUnder10Price!: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(160) metaTitle?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(300) metaDescription?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() includedText?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notIncludedText?: string;
  @ApiProperty({ required: false, type: [TourDayDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => TourDayDto) @IsOptional() days?: TourDayDto[];
}

export class UpdateTourDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(200) title?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(500) shortDescription?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() destinationId?: string;
  @ApiProperty({ required: false }) @IsInt() @Min(1) @IsOptional() durationDays?: number;
  @ApiProperty({ required: false }) @IsInt() @Min(0) @IsOptional() durationNights?: number;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() basePrice?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() currency?: string;
  @ApiProperty({ required: false, enum: Object.values(TOUR_STATUSES) }) @IsEnum(TOUR_STATUSES) @IsOptional() status?: TourStatusValue;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() adultPrice?: number;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() child10to14Price?: number;
  @ApiProperty({ required: false }) @IsNumber() @Min(0) @IsOptional() childUnder10Price?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(160) metaTitle?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(300) metaDescription?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() includedText?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notIncludedText?: string;
}

const SORTS = { price_asc: 'price_asc', price_desc: 'price_desc', newest: 'newest', title: 'title' } as const;

export class ListToursQuery {
  @ApiProperty({ required: false }) @IsString() @IsOptional() search?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() destination?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() city?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() dateFrom?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() dateTo?: string;
  @ApiProperty({ required: false }) @Type(() => Number) @IsInt() @Min(1) @IsOptional() durationDays?: number;
  @ApiProperty({ required: false }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() minPrice?: number;
  @ApiProperty({ required: false }) @Type(() => Number) @IsNumber() @Min(0) @IsOptional() maxPrice?: number;
  @ApiProperty({ required: false, enum: Object.values(SORTS) }) @IsEnum(SORTS) @IsOptional() sort?: string;
  @ApiProperty({ required: false, enum: Object.values(TOUR_STATUSES) }) @IsEnum(TOUR_STATUSES) @IsOptional() status?: TourStatusValue;
  @ApiProperty({ required: false }) @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number;
  @ApiProperty({ required: false }) @Type(() => Number) @IsInt() @Min(1) @IsOptional() perPage?: number;
}
