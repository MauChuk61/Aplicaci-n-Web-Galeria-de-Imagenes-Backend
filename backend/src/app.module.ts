import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PostsModule } from './modules/posts/posts.module';
import { SavedPostsModule } from './modules/saved-posts/saved-posts.module';
import { LikesModule } from './modules/likes/likes.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MessagesModule } from './modules/messages/messages.module';
import { User } from './entities/user.entity';
import { Post } from './entities/post.entity';
import { SavedPost } from './entities/saved-post.entity';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Notification } from './entities/notification.entity';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'neochuk',
      entities: [User, Post, SavedPost, Like, Comment, Notification, Conversation, Message],
      synchronize: true, // Solo en desarrollo, desactivar en producción
      logging: false,
    }),
    AuthModule,
    UserModule,
    PostsModule,
    SavedPostsModule,
    LikesModule,
    CommentsModule,
    NotificationsModule,
    MessagesModule,
  ],
})
export class AppModule {}
