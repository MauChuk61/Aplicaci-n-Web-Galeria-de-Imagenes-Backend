import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPost } from '../../entities/saved-post.entity';
import { Post } from '../../entities/post.entity';

@Injectable()
export class SavedPostsService {
  constructor(
    @InjectRepository(SavedPost)
    private savedPostsRepository: Repository<SavedPost>,
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
  ) {}

  async savePost(userId: string, postId: string): Promise<SavedPost> {
    // Verificar si el post existe
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }

    // Verificar si ya está guardado
    const existing = await this.savedPostsRepository.findOne({
      where: { userId, postId },
    });

    if (existing) {
      return existing;
    }

    // Guardar el post
    const savedPost = this.savedPostsRepository.create({
      userId,
      postId,
    });

    return this.savedPostsRepository.save(savedPost);
  }

  async unsavePost(userId: string, postId: string): Promise<void> {
    const savedPost = await this.savedPostsRepository.findOne({
      where: { userId, postId },
    });

    if (savedPost) {
      await this.savedPostsRepository.remove(savedPost);
    }
  }

  async getSavedPosts(userId: string): Promise<Post[]> {
    const savedPosts = await this.savedPostsRepository.find({
      where: { userId },
      relations: ['post', 'post.user'],
      order: { createdAt: 'DESC' },
    });

    return savedPosts.map(sp => sp.post);
  }

  async isSaved(userId: string, postId: string): Promise<boolean> {
    const savedPost = await this.savedPostsRepository.findOne({
      where: { userId, postId },
    });

    return !!savedPost;
  }
}
