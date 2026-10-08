import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@chirkeytour.ru" })
  @Transform(({ value }) => (typeof value === "string" ? value.toLowerCase().trim() : value))
  @IsEmail({}, { message: "Укажите корректный email" })
  email!: string;

  @ApiProperty({ example: "••••••••" })
  @IsString()
  @IsNotEmpty({ message: "Введите пароль" })
  @MinLength(8, { message: "Минимум 8 символов" })
  password!: string;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  remember?: boolean;
}
