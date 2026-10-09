import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class PresignDto {
  @ApiProperty() @IsString() @MaxLength(255) filename!: string;
  @ApiProperty() @IsString() @MaxLength(100) contentType!: string;
}

export class RegisterFileDto {
  @ApiProperty() @IsString() @MaxLength(500) key!: string;
  @ApiProperty() @IsUrl({ require_tld: false }) url!: string;
  @ApiProperty() @IsString() @MaxLength(255) filename!: string;
  @ApiProperty() @IsString() @MaxLength(100) mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) size!: number;
  @ApiProperty({ required: false }) @IsInt() @Min(1) @IsOptional() width?: number;
  @ApiProperty({ required: false }) @IsInt() @Min(1) @IsOptional() height?: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(300) alt?: string;
}

export class AltDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional() @MaxLength(300) alt?: string;
}
