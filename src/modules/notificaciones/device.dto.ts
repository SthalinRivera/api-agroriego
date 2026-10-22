import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class RegisterDeviceDto {
  @IsString() @MinLength(1) @MaxLength(4096) token: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(4096) previousToken?: string;
  @IsIn(['android', 'ios']) plataforma: string;
}
export class UnregisterDeviceDto {
  @IsString() @MinLength(1) @MaxLength(4096) token: string;
}
