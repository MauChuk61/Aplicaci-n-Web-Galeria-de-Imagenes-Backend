import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavedPostsController } from './saved-posts.controller';
import { SavedPostsService } from './saved-posts.service';
import { SavedPost } from '../../entities/saved-post.entity';
import { Post } from '../../entities/post.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavedPost, Post])],
  controllers: [SavedPostsController],
  providers: [SavedPostsService],
})
export class SavedPostsModule {}
