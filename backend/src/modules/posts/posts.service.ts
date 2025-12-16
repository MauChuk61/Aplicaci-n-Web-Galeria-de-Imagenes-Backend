import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Post } from '../../entities/post.entity';
import { SavedPost } from '../../entities/saved-post.entity';
import { User } from '../../entities/user.entity';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { LikesService } from '../likes/likes.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(SavedPost)
    private savedPostRepository: Repository<SavedPost>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private likesService: LikesService,
  ) {}

  async create(createPostDto: CreatePostDto, userId: string): Promise<Post> {
    const post = this.postsRepository.create({
      ...createPostDto,
      userId,
    });
    return this.postsRepository.save(post);
  }

  async findAll(userId?: string): Promise<any[]> {
    const posts = await this.postsRepository.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    if (!userId) {
      return posts;
    }

    const postsWithStatus = await Promise.all(
      posts.map(async (post) => {
        const hasLiked = await this.likesService.hasLiked(userId, post.id);
        const savedPost = await this.savedPostRepository.findOne({
          where: { userId, postId: post.id },
        });
        const isSaved = !!savedPost;
        
        return {
          ...post,
          hasLiked,
          isSaved,
        };
      }),
    );

    return postsWithStatus;
  }

  async findFeedPosts(userId: string, page: number = 1, limit: number = 10): Promise<any> {
    // Obtener IDs de usuarios que sigue
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['following'],
    });

    if (!user) {
      return { posts: [], hasMore: false };
    }

    const followingIds = user.following?.map((u: any) => u.id) || [];
    
    // Incluir el propio userId para mostrar también sus publicaciones
    const userIdsToShow = [...followingIds, userId];
    
    // Si no hay IDs para mostrar (aunque siempre debería tener al menos el propio)
    if (userIdsToShow.length === 0) {
      return { posts: [], hasMore: false };
    }

    // Obtener posts de usuarios seguidos + propios con paginación
    const skip = (page - 1) * limit;
    const [posts, total] = await this.postsRepository.findAndCount({
      where: { userId: In(userIdsToShow) },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Añadir información de liked y saved
    const postsWithStatus = await Promise.all(
      posts.map(async (post) => {
        const hasLiked = await this.likesService.hasLiked(userId, post.id);
        const savedPost = await this.savedPostRepository.findOne({
          where: { userId, postId: post.id },
        });
        const isSaved = !!savedPost;
        
        return {
          ...post,
          hasLiked,
          isSaved,
        };
      }),
    );

    return {
      posts: postsWithStatus,
      hasMore: skip + posts.length < total,
    };
  }

  async findByUser(userId: string): Promise<Post[]> {
    return this.postsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!post) {
      throw new NotFoundException('Post no encontrado');
    }
    return post;
  }

  async update(id: string, updatePostDto: UpdatePostDto, userId: string): Promise<Post> {
    const post = await this.findOne(id);
    
    if (post.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este post');
    }

    Object.assign(post, updatePostDto);
    return this.postsRepository.save(post);
  }

  async remove(id: string, userId: string): Promise<void> {
    const post = await this.findOne(id);
    
    if (post.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este post');
    }

    await this.postsRepository.remove(post);
  }
}
