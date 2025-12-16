import { IsString, IsOptional } from 'class-validator';

export class CreatePostDto {
  @IsString()
  imageUrl: string;

  @IsString()
  @IsOptional()
  caption?: string;
}

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  caption?: string;
}
