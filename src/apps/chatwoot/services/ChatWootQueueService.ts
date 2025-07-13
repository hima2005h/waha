import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EventName } from '@waha/apps/chatwoot/client/types';
import { InboxData } from '@waha/apps/chatwoot/consumers/types';
import { Queue } from 'bullmq';

import { QueueName } from '../consumers/QueueName';

/**
 * Service for managing ChatWoot queues for inbox events
 * This service is used to centralize queue configuration and job options
 */
@Injectable()
export class ChatWootQueueService {
  constructor(
    @InjectQueue(QueueName.INBOX_MESSAGE_CREATED)
    private readonly messageCreatedQueue: Queue,
    @InjectQueue(QueueName.INBOX_MESSAGE_UPDATED)
    private readonly messageUpdatedQueue: Queue,
    @InjectQueue(QueueName.INBOX_MESSAGE_DELETED)
    private readonly messageDeletedQueue: Queue,
    @InjectQueue(QueueName.INBOX_COMMANDS)
    private readonly commandsQueue: Queue,
  ) {}

  /**
   * Generic method to add a job to a queue
   * @param queue The queue to add the job to
   * @param name The name of the job
   * @param data The data for the job
   * @returns The result of adding the job to the queue
   */
  async add(queue: Queue, name: string, data: any): Promise<any> {
    return await queue.add(name, data);
  }

  /**
   * Get the specific queue for an event
   * @param event The event to get the queue for
   * @returns The queue for the event, or null if there is no specific queue
   */
  private getQueueForEvent(event: string): Queue | null {
    switch (event) {
      case EventName.MESSAGE_CREATED:
        return this.messageCreatedQueue;
      case EventName.MESSAGE_UPDATED:
        return this.messageUpdatedQueue;
      case 'message_deleted':
        return this.messageDeletedQueue;
      case 'commands':
        return this.commandsQueue;
      default:
        return null;
    }
  }

  /**
   * Add a job to the message created queue
   */
  async addMessageCreatedJob(data: InboxData): Promise<any> {
    return await this.add(
      this.messageCreatedQueue,
      EventName.MESSAGE_CREATED,
      data,
    );
  }

  /**
   * Add a job to the message updated queue
   */
  async addMessageUpdatedJob(data: InboxData): Promise<any> {
    return await this.add(
      this.messageUpdatedQueue,
      EventName.MESSAGE_UPDATED,
      data,
    );
  }

  /**
   * Add a job to the message deleted queue
   */
  async addMessageDeletedJob(data: InboxData): Promise<any> {
    return await this.add(this.messageDeletedQueue, 'message_deleted', data);
  }

  /**
   * Add a job to the commands queue
   */
  async addCommandsJob(event: string, data: InboxData): Promise<any> {
    return await this.add(this.commandsQueue, event, data);
  }

  /**
   * Add a job to the appropriate queue based on the event
   */
  async addJobToQueue(event: string, data: InboxData): Promise<any> {
    const queue = this.getQueueForEvent(event);
    if (queue) {
      return await this.add(queue, event, data);
    }
    return { ignored: true, event };
  }
}
