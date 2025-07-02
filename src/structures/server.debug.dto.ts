import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class BrowserTraceQuery {
  @Type(() => Number)
  @IsNumber()
  @ApiProperty({
    description: 'How many seconds to trace',
    example: 30,
    required: true,
  })
  seconds: number = 30;

  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsOptional()
  @ApiProperty({
    description: 'Categories to trace (all by default)',
    example: ['*'],
    required: true,
  })
  categories: string[] = ['*'];
}
