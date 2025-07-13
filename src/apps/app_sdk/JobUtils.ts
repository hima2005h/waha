import { Job } from 'bullmq';
import { Backoffs } from 'bullmq';

/**
 * Calculates the delay until the next attempt for a job.
 *
 * @param job The job to calculate the next attempt delay for
 * @returns The delay in milliseconds, or null if there is no next attempt or backoff is not set
 */
export function NextAttemptDelayInMs(job: Job): number | null {
  const attemptsMade = job.attemptsMade + 1;
  const maxAttempts = job.opts?.attempts || 1;
  // If this is the last attempt, return null
  if (attemptsMade >= maxAttempts) {
    return null;
  }
  // Normalize the backoff options
  const backoff = Backoffs.normalize(job.opts.backoff);
  if (!backoff) {
    return null;
  }
  // Calculate the delay using Backoffs.calculate
  const delay = Backoffs.calculate(backoff, attemptsMade, new Error(), job);
  // The delay can be a Promise, a number, or undefined
  if (delay === undefined) {
    return null;
  }
  // If it's a Promise, we can't handle it synchronously, so return null
  if (delay instanceof Promise) {
    return null;
  }
  return delay;
}

export function NextAttemptDelayInWholeSeconds(job: Job) {
  const delay = NextAttemptDelayInMs(job);
  if (delay == null) {
    return null;
  }
  return Math.round(delay / 1000);
}

/**
 * Checks if a job has been retried (not on its first attempt).
 *
 * @param job The job to check
 * @returns True if the job has been retried (attemptsMade > 1), false otherwise
 */
export function HasBeenRetried(job: Job): boolean {
  const attemptsMade = job.attemptsMade + 1;
  return attemptsMade > 1;
}
