import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from '../../entities/like.entity';
import { Post } from '../../entities/post.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    private notificationsService: NotificationsService,
  ) {}

  async likePost(userId: string, postId: string): Promise<void> {
    const existingLike = await this.likeRepository.findOne({
      where: { userId, postId },
    });

    if (existingLike) {
      return;
    }

    const like = this.likeRepository.create({ userId, postId });
    await this.likeRepository.save(like);

    await this.postRepository.increment({ id: postId }, 'likes', 1);

    // Crear notificación
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (post && post.userId !== userId) {
      await this.notificationsService.createNotification(
        post.userId,
        userId,
        'like',
        postId,
        'le dio me gusta a tu publicación',
      );
    }
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    const like = await this.likeRepository.findOne({
      where: { userId, postId },
    });

    if (!like) {
      return;
    }

    await this.likeRepository.remove(like);
    await this.postRepository.decrement({ id: postId }, 'likes', 1);
  }

  async hasLiked(userId: string, postId: string): Promise<boolean> {
    const like = await this.likeRepository.findOne({
      where: { userId, postId },
    });
    return !!like;
  }

  async getLikesCount(postId: string): Promise<number> {
    return await this.likeRepository.count({ where: { postId } });
  }
}
