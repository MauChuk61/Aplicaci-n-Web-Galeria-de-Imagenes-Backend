import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Conversation } from '../../entities/conversation.entity';
import { Message } from '../../entities/message.entity';
import { User } from '../../entities/user.entity';
import { CreateMessageDto } from './dto/message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async getOrCreateConversation(userId: string, otherUserId: string): Promise<Conversation> {
    // Buscar conversación existente entre estos dos usuarios
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .where('participant.id IN (:...userIds)', { userIds: [userId, otherUserId] })
      .getMany();

    // Filtrar conversaciones que tengan exactamente estos dos participantes
    const existingConversation = conversations.find((conv) => {
      const participantIds = conv.participants.map((p) => p.id).sort();
      const targetIds = [userId, otherUserId].sort();
      return participantIds.length === 2 && 
             participantIds[0] === targetIds[0] && 
             participantIds[1] === targetIds[1];
    });

    if (existingConversation) {
      return existingConversation;
    }

    // Crear nueva conversación
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const otherUser = await this.userRepository.findOne({ where: { id: otherUserId } });

    if (!user || !otherUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const conversation = this.conversationRepository.create({
      participants: [user, otherUser],
    });

    return this.conversationRepository.save(conversation);
  }

  async sendMessage(userId: string, createMessageDto: CreateMessageDto): Promise<Message> {
    const { content, recipientId } = createMessageDto;

    // Obtener o crear conversación
    const conversation = await this.getOrCreateConversation(userId, recipientId);

    // Crear mensaje
    const message = this.messageRepository.create({
      content,
      senderId: userId,
      conversationId: conversation.id,
    });

    const savedMessage = await this.messageRepository.save(message);

    // Actualizar última actividad de la conversación
    conversation.lastMessageText = content;
    conversation.lastMessageAt = new Date();
    await this.conversationRepository.save(conversation);

    // Cargar el mensaje con las relaciones completas
    const messageWithRelations = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender', 'conversation'],
    });

    if (!messageWithRelations) {
      throw new Error('Error al cargar el mensaje');
    }

    // Asegurar que conversationId esté presente en la respuesta
    return {
      ...messageWithRelations,
      conversationId: conversation.id,
      sender: {
        id: messageWithRelations.sender.id,
        username: messageWithRelations.sender.username,
        fullName: messageWithRelations.sender.fullName,
        profileImage: messageWithRelations.sender.profileImage,
      }
    } as any;
  }

  async getConversationById(conversationId: string, userId: string) {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const isParticipant = conversation.participants.some((p) => p.id === userId);
    if (!isParticipant) {
      throw new NotFoundException('Conversación no encontrada');
    }

    // Obtener el otro participante
    const otherUser = conversation.participants.find((p) => p.id !== userId);

    return {
      id: conversation.id,
      otherUser: otherUser ? {
        id: otherUser.id,
        username: otherUser.username,
        fullName: otherUser.fullName,
        profileImage: otherUser.profileImage,
      } : null,
      createdAt: conversation.createdAt,
      lastMessageAt: conversation.lastMessageAt,
      lastMessageText: conversation.lastMessageText,
    };
  }

  async getConversations(userId: string): Promise<any[]> {
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.participants', 'participant')
      .leftJoin('conversation.participants', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('conversation.lastMessageAt', 'DESC', 'NULLS LAST')
      .addOrderBy('conversation.createdAt', 'DESC')
      .getMany();

    // Para cada conversación, contar los mensajes no leídos para este usuario
    const result = [];
    for (const conv of conversations) {
      const otherUser = conv.participants.find((p) => p.id !== userId);
      // Contar mensajes no leídos en esta conversación
      const unreadCount = await this.messageRepository.count({
        where: {
          conversationId: conv.id,
          senderId: Not(userId),
          read: false,
        },
      });
      result.push({
        id: conv.id,
        otherUser: otherUser ? {
          id: otherUser.id,
          username: otherUser.username,
          fullName: otherUser.fullName,
          profileImage: otherUser.profileImage,
        } : null,
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        unreadCount,
      });
    }
    return result;
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    // Verificar que el usuario es participante de la conversación
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ['participants'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    const isParticipant = conversation.participants.some((p) => p.id === userId);
    if (!isParticipant) {
      throw new NotFoundException('No tienes acceso a esta conversación');
    }

    // Obtener mensajes
    const messages = await this.messageRepository.find({
      where: { conversationId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });

    // Marcar mensajes como leídos
    await this.messageRepository.update(
      { conversationId, senderId: Not(userId), read: false },
      { read: true }
    );

    return messages;
  }

  async getUnreadCount(userId: string): Promise<number> {
    // Obtener IDs de conversaciones del usuario
    const conversations = await this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoin('conversation.participants', 'participant')
      .where('participant.id = :userId', { userId })
      .select('conversation.id')
      .getMany();

    const conversationIds = conversations.map((c) => c.id);

    if (conversationIds.length === 0) {
      return 0;
    }

    // Contar mensajes no leídos en esas conversaciones
    const count = await this.messageRepository.count({
      where: {
        conversationId: In(conversationIds),
        senderId: Not(userId),
        read: false,
      },
    });

    return count;
  }
}
