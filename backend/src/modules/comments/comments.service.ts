import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from '../../entities/comment.entity';
import { Post } from '../../entities/post.entity';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    private notificationsService: NotificationsService,
  ) {}

  async create(createCommentDto: CreateCommentDto, userId: string): Promise<Comment> {
    const comment = this.commentRepository.create({
      ...createCommentDto,
      userId,
    });
    const savedComment = await this.commentRepository.save(comment);
    
    // Crear notificación
    const post = await this.postRepository.findOne({ where: { id: createCommentDto.postId } });
    if (post && post.userId !== userId) {
      await this.notificationsService.createNotification(
        post.userId,
        userId,
        'comment',
        createCommentDto.postId,
        'comentó en tu publicación',
      );
    }
    
    // Devolver el comentario con la relación del usuario
    return this.commentRepository.findOne({
      where: { id: savedComment.id },
      relations: ['user'],
    });
  }

  async findByPost(postId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { postId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    return comment;
  }

  async update(id: string, updateCommentDto: UpdateCommentDto, userId: string): Promise<Comment> {
    const comment = await this.findOne(id);
    
    if (comment.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este comentario');
    }

    Object.assign(comment, updateCommentDto);
    return this.commentRepository.save(comment);
  }

  async remove(id: string, userId: string): Promise<void> {
    const comment = await this.findOne(id);
    
    if (comment.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este comentario');
    }

    await this.commentRepository.remove(comment);
  }

  async getCommentsCount(postId: string): Promise<number> {
    return this.commentRepository.count({ where: { postId } });
  }
}
