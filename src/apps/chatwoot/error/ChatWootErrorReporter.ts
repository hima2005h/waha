import type { conversation_message_create } from '@figuro/chatwoot-sdk/dist/models/conversation_message_create';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import { NextAttemptDelayInWholeSeconds } from '@waha/apps/app_sdk/JobUtils';
import { Conversation } from '@waha/apps/chatwoot/client/Conversation';
import { MessageType } from '@waha/apps/chatwoot/client/types';
import { ErrorRenderer } from '@waha/apps/chatwoot/error/ErrorRenderer';
import { Locale, TKey } from '@waha/apps/chatwoot/locale';
import { Job } from 'bullmq';

export class ChatWootErrorReporter {
  private errorRenderer: ErrorRenderer = new ErrorRenderer();

  constructor(
    private logger: ILogger,
    private job: Job,
    private l: Locale,
  ) {}

  async ReportError(
    conversation: Conversation,
    header: string,
    type: MessageType,
    error: any,
    replyTo?: number,
  ) {
    const errorText = this.errorRenderer.renderError(error);
    this.logger.error(errorText);
    const errorUrl = `http://localhost:3000/jobs/queue/${encodeURIComponent(
      this.job.queueName,
    )}/${this.job.id}`;
    const template = this.l.key(TKey.JOB_ERROR_REPORT);
    const nextDelay = NextAttemptDelayInWholeSeconds(this.job);
    const attempts = {
      current: this.job.attemptsMade + 1,
      max: this.job.opts?.attempts || 1,
      nextDelay: nextDelay,
    };
    const content = template.render({
      header: header,
      error: nextDelay != null ? null : errorText,
      details: {
        text: `${this.job.queueName} => ${this.job.id}`,
        url: errorUrl,
      },
      attempts: attempts,
    });
    const request: conversation_message_create = {
      content: content,
      message_type: type as any,
      private: true, // Always private note
    };
    if (replyTo) {
      request.content_attributes = {
        in_reply_to: replyTo,
      };
    }
    await conversation.send(request);
  }

  /**
   * Reports a job as recovered after retries.
   * This method will only send a report if the job has been retried (not on its first attempt).
   *
   * @param conversation The conversation to send the report to
   * @param type The message type
   * @param replyTo Optional message ID to reply to
   * @returns Promise that resolves when the report is sent, or void if no report is sent
   */
  async ReportSucceeded(
    conversation: Conversation,
    type: MessageType,
    replyTo?: number,
  ): Promise<void> {
    const jobUrl = `http://localhost:3000/jobs/queue/${encodeURIComponent(
      this.job.queueName,
    )}/${this.job.id}`;
    const template = this.l.key(TKey.JOB_SUCCEEDED_REPORT);
    const attempts = {
      current: this.job.attemptsMade + 1,
      max: this.job.opts?.attempts || 1,
    };

    const content = template.render({
      details: {
        text: `${this.job.queueName} => ${this.job.id}`,
        url: jobUrl,
      },
      attempts: attempts,
    });

    const request: conversation_message_create = {
      content: content,
      message_type: type as any,
      private: true, // Always private note
    };

    if (replyTo) {
      request.content_attributes = {
        in_reply_to: replyTo,
      };
    }

    await conversation.send(request);
  }
}
