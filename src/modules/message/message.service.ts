import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { SendTextMessageDto, SendMediaMessageDto, MessageResponseDto } from './dto';
import { MediaInput } from '../../engine/interfaces/whatsapp-engine.interface';
import { Message, MessageDirection } from './entities/message.entity';
import { HookManager } from '../../core/hooks';

export interface GetMessagesOptions {
  chatId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message, 'data')
    private readonly messageRepository: Repository<Message>,
    private readonly sessionService: SessionService,
    private readonly hookManager: HookManager,
  ) {}

  async sendText(sessionId: string, dto: SendTextMessageDto): Promise<MessageResponseDto> {
    // Execute hook before sending - plugins can modify or block
    const { continue: shouldContinue, data: hookData } = await this.hookManager.execute(
      'message:sending',
      { sessionId, input: dto, type: 'text' },
      { sessionId, source: 'MessageService' },
    );

    if (!shouldContinue) {
      throw new BadRequestException('Message sending blocked by plugin');
    }

    // Use potentially modified input
    const finalDto = (hookData as { input: SendTextMessageDto }).input;

    const engine = this.getEngine(sessionId);

    try {
      const result = await engine.sendTextMessage(finalDto.chatId, finalDto.text);

      // Save to history
      await this.saveOutgoingMessage(sessionId, {
        waMessageId: result.id,
        chatId: finalDto.chatId,
        body: finalDto.text,
        type: 'text',
        timestamp: result.timestamp,
      });

      // Execute hook after successful send
      await this.hookManager.execute(
        'message:sent',
        { sessionId, result, input: finalDto },
        { sessionId, source: 'MessageService' },
      );

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      // Execute hook on failure
      await this.hookManager.execute(
        'message:failed',
        { sessionId, error: error instanceof Error ? error.message : String(error), input: finalDto },
        { sessionId, source: 'MessageService' },
      );

      throw error;
    }
  }

  async sendImage(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);
    const result = await engine.sendImageMessage(dto.chatId, media);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      body: dto.caption || '',
      type: 'image',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async sendVideo(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);
    const result = await engine.sendVideoMessage(dto.chatId, media);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      body: dto.caption || '',
      type: 'video',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async sendAudio(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);
    const result = await engine.sendAudioMessage(dto.chatId, media);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      type: 'audio',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async sendDocument(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);
    const result = await engine.sendDocumentMessage(dto.chatId, media);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      body: dto.filename || '',
      type: 'document',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  /**
   * Get message history for a session
   */
  async getMessages(
    sessionId: string,
    options: GetMessagesOptions = {},
  ): Promise<{ messages: Message[]; total: number }> {
    const { chatId, limit = 50, offset = 0 } = options;

    const query = this.messageRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId })
      .orderBy('message.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (chatId) {
      query.andWhere('message.chatId = :chatId', { chatId });
    }

    const [messages, total] = await query.getManyAndCount();
    return { messages, total };
  }

  // ========== Phase 3: Extended Messaging ==========

  async sendLocation(
    sessionId: string,
    dto: { chatId: string; latitude: number; longitude: number; description?: string; address?: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const result = await engine.sendLocationMessage(dto.chatId, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      description: dto.description,
      address: dto.address,
    });

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      body: `📍 ${dto.description || 'Location'}`,
      type: 'location',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async sendContact(
    sessionId: string,
    dto: { chatId: string; contactName: string; contactNumber: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const result = await engine.sendContactMessage(dto.chatId, {
      name: dto.contactName,
      number: dto.contactNumber,
    });

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      body: `📇 ${dto.contactName}`,
      type: 'contact',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async sendSticker(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);
    const result = await engine.sendStickerMessage(dto.chatId, media);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      type: 'sticker',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async reply(
    sessionId: string,
    dto: { chatId: string; quotedMessageId: string; text: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const result = await engine.replyToMessage(dto.chatId, dto.quotedMessageId, dto.text);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.chatId,
      body: dto.text,
      type: 'text',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  async forward(
    sessionId: string,
    dto: { fromChatId: string; toChatId: string; messageId: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const result = await engine.forwardMessage(dto.fromChatId, dto.toChatId, dto.messageId);

    await this.saveOutgoingMessage(sessionId, {
      waMessageId: result.id,
      chatId: dto.toChatId,
      body: '[Forwarded]',
      type: 'forward',
      timestamp: result.timestamp,
    });

    return {
      messageId: result.id,
      timestamp: result.timestamp,
    };
  }

  /**
   * Save incoming message (called from session webhook dispatch)
   */
  async saveIncomingMessage(sessionId: string, data: Partial<Message>): Promise<Message> {
    const message = this.messageRepository.create({
      ...data,
      sessionId,
      direction: MessageDirection.INCOMING,
    });
    return this.messageRepository.save(message);
  }

  /**
   * Save outgoing message after successful send
   */
  private async saveOutgoingMessage(
    sessionId: string,
    data: {
      waMessageId: string;
      chatId: string;
      body?: string;
      type: string;
      timestamp: number;
    },
  ): Promise<Message> {
    const session = await this.sessionService.findOne(sessionId);
    const message = this.messageRepository.create({
      sessionId,
      waMessageId: data.waMessageId,
      chatId: data.chatId,
      from: session?.phone || 'me',
      to: data.chatId,
      body: data.body,
      type: data.type,
      direction: MessageDirection.OUTGOING,
      timestamp: data.timestamp,
    });
    return this.messageRepository.save(message);
  }

  // ========== Phase 3: Reactions ==========

  async reactToMessage(sessionId: string, dto: { chatId: string; messageId: string; emoji: string }): Promise<void> {
    const engine = this.getEngine(sessionId);
    await engine.reactToMessage(dto.chatId, dto.messageId, dto.emoji);
  }

  async getMessageReactions(sessionId: string, chatId: string, messageId: string) {
    const engine = this.getEngine(sessionId);
    return engine.getMessageReactions(chatId, messageId);
  }

  // ========== Delete Message ==========

  async deleteMessage(
    sessionId: string,
    dto: { chatId: string; messageId: string; forEveryone?: boolean },
  ): Promise<void> {
    const engine = this.getEngine(sessionId);
    await engine.deleteMessage(dto.chatId, dto.messageId, dto.forEveryone ?? true);
  }

  private getEngine(sessionId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new BadRequestException(`Session '${sessionId}' is not active. Start the session first.`);
    }
    return engine;
  }

  private buildMediaInput(dto: SendMediaMessageDto): MediaInput {
    if (!dto.url && !dto.base64) {
      throw new BadRequestException('Either url or base64 must be provided');
    }

    if (dto.base64 && !dto.mimetype) {
      throw new BadRequestException('mimetype is required when using base64 data');
    }

    return {
      mimetype: dto.mimetype || 'application/octet-stream',
      data: dto.url || dto.base64!,
      filename: dto.filename,
      caption: dto.caption,
    };
  }
}
