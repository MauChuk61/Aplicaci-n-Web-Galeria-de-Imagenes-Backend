import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/message.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getConversations(@Request() req) {
    return this.messagesService.getConversations(req.user.id);
  }

  @Get('conversations/:id/details')
  getConversationDetails(@Param('id') conversationId: string, @Request() req) {
    return this.messagesService.getConversationById(conversationId, req.user.id);
  }

  @Get('conversations/:id')
  getMessages(@Param('id') conversationId: string, @Request() req) {
    return this.messagesService.getMessages(conversationId, req.user.id);
  }

  @Post()
  sendMessage(@Body() createMessageDto: CreateMessageDto, @Request() req) {
    return this.messagesService.sendMessage(req.user.id, createMessageDto);
  }

  @Post('conversations/create')
  async createConversation(@Body() body: { participantId: string }, @Request() req) {
    const conversation = await this.messagesService.getOrCreateConversation(req.user.id, body.participantId);
    
    // Obtener información del otro usuario para retornar en formato de conversación
    const conversationDetails = await this.messagesService.getConversationById(conversation.id, req.user.id);
    return conversationDetails;
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.messagesService.getUnreadCount(req.user.id);
  }
}
