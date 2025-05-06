import { WAMessageAckBody } from '@waha/structures/webhooks.dto';
import { distinct, interval } from 'rxjs';

export function DistinctAck(flushEvery: number = 60_000) {
  // only if we haven’t seen this key since the last flush
  return distinct(
    (msg: WAMessageAckBody) => `${msg.id}-${msg.ack}-${msg.participant}`,
    interval(flushEvery),
  );
}
