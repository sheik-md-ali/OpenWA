import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createLogger } from '../../../common/services/logger.service';
import { QUEUE_NAMES } from '../queue-names';

export interface MessageJobData {
  sessionId: string;
  to: string;
  content: string;
  type: 'text' | 'media';
  mediaUrl?: string;
  mediaType?: string;
}

export interface MessageJobResult {
  messageId: string;
  timestamp: Date;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * @deprecated This processor is a placeholder and NOT IMPLEMENTED.
 * Message queue is not yet functional. Using this will result in an error.
 *
 * TODO: Implement actual message delivery via SessionService/MessageService
 * - Inject SessionService to get active session
 * - Use MessageService.send() for actual delivery
 * - Handle session not found, not ready, etc.
 */
@Processor(QUEUE_NAMES.MESSAGE)
export class MessageProcessor extends WorkerHost {
  private readonly logger = createLogger('MessageProcessor');

  async process(job: Job<MessageJobData>): Promise<never> {
    this.logger.log(`Processing message job ${job.id}`, {
      sessionId: job.data.sessionId,
      to: job.data.to,
      action: 'message_process_start',
    });

    // FAIL FAST: Throw error so BullMQ marks job as failed
    const errorMessage =
      'MessageProcessor is not implemented. Message queue is disabled. ' + 'Use direct MessageService.send() instead.';

    this.logger.error(`Message job ${job.id} failed: ${errorMessage}`, undefined, {
      sessionId: job.data.sessionId,
      action: 'message_process_not_implemented',
    });

    // Throw error to make BullMQ mark job as failed (not completed)
    return Promise.reject(new Error(errorMessage));
  }
}
