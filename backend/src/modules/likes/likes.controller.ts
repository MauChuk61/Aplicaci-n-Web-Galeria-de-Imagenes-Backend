import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LikesService } from './likes.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':postId/like')
  async likePost(@Param('postId') postId: string, @Request() req) {
    const userId = req.user.id;
    await this.likesService.likePost(userId, postId);
    return { message: 'Post liked successfully' };
  }

  @Delete(':postId/like')
  async unlikePost(@Param('postId') postId: string, @Request() req) {
    const userId = req.user.id;
    await this.likesService.unlikePost(userId, postId);
    return { message: 'Post unliked successfully' };
  }

  @Get(':postId/liked')
  async checkLikeStatus(@Param('postId') postId: string, @Request() req) {
    const userId = req.user.id;
    const hasLiked = await this.likesService.hasLiked(userId, postId);
    return { hasLiked };
  }
}
