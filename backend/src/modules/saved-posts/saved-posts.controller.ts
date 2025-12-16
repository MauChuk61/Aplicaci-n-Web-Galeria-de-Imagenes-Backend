import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { SavedPostsService } from './saved-posts.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@Controller('saved-posts')
@UseGuards(JwtAuthGuard)
export class SavedPostsController {
  constructor(private readonly savedPostsService: SavedPostsService) {}

  @Get()
  async getSavedPosts(@Request() req) {
    return this.savedPostsService.getSavedPosts(req.user.id);
  }

  @Get(':postId/status')
  async checkSavedStatus(@Request() req, @Param('postId') postId: string) {
    const isSaved = await this.savedPostsService.isSaved(req.user.id, postId);
    return { isSaved };
  }

  @Post(':postId')
  async savePost(@Request() req, @Param('postId') postId: string) {
    const savedPost = await this.savedPostsService.savePost(req.user.id, postId);
    return { message: 'Post guardado', savedPost };
  }

  @Delete(':postId')
  async unsavePost(@Request() req, @Param('postId') postId: string) {
    await this.savedPostsService.unsavePost(req.user.id, postId);
    return { message: 'Post eliminado de guardados' };
  }
}
