import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QueueName } from '../consumers/QueueName';

/**
 * Service for scheduling ChatWoot tasks
 * This service is used to schedule periodic tasks for ChatWoot
 */
@Injectable()
export class ChatWootScheduleService {
  constructor(
    @InjectQueue(QueueName.SCHEDULED_MESSAGE_CLEANUP)
    private readonly messageCleanupQueue: Queue,
    @InjectQueue(QueueName.SCHEDULED_CHECK_VERSION)
    private readonly checkVersionQueue: Queue,
  ) {}

  /**
   * Schedule periodic tasks for a ChatWoot app
   * @param appId The ID of the app
   * @param sessionName The name of the session
   */
  async schedule(appId: string, sessionName: string): Promise<void> {
    // Message Cleanup
    await this.messageCleanupQueue.upsertJobScheduler(
      this.JobId(QueueName.SCHEDULED_MESSAGE_CLEANUP, appId),
      // Every day at 17:00
      { pattern: '0 0 17 * * *' },
      {
        data: {
          app: appId,
          session: sessionName,
        },
      },
    );
    // Check the version
    await this.checkVersionQueue.upsertJobScheduler(
      this.JobId(QueueName.SCHEDULED_CHECK_VERSION, appId),
      // Every Wednesday (3) at 18:00
      { pattern: '0 0 18 * * 3' },
      {
        data: {
          app: appId,
          session: sessionName,
        },
      },
    );
  }

  async unschedule(appId: string, sessionName: string): Promise<void> {
    // Message Cleanup
    await this.messageCleanupQueue.removeJobScheduler(
      this.JobId(QueueName.SCHEDULED_MESSAGE_CLEANUP, appId),
    );
    // Check the version
    await this.checkVersionQueue.removeJobScheduler(
      this.JobId(QueueName.SCHEDULED_CHECK_VERSION, appId),
    );
  }

  private JobId(queue: QueueName, appId: string) {
    return `${queue} | ${appId}`;
  }
}
