import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsNotEmpty()
  @IsUUID()
  recipientId: string;
}

export class CreateConversationDto {
  @IsNotEmpty()
  @IsUUID()
  participantId: string;
}
