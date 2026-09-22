import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsString()
  emailOrUsername!: string;

  @ApiProperty({ example: 'your-secure-password' })
  @IsString()
  @MinLength(6)
  password!: string;
}
