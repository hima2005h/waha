import {
  areJidsSameUser,
  BinaryNode,
  getBinaryNodeChildren,
  getStatusFromReceiptType,
  isJidGroup,
  isJidStatusBroadcast,
  jidEncode,
  jidNormalizedUser,
  proto,
} from '@adiwajshing/baileys';

export interface ReceiptEvent {
  key: proto.IMessageKey;
  participant?: string;
  messageIds: string[];
  status: number;
  _node: any;
}

interface Me {
  id: string;
  lid?: string;
}

function jid(field: any) {
  if (!field) {
    return field;
  }
  const data = field['$1'];
  if (!data) {
    return data;
  }

  let server = data.server;
  if (!server) {
    server =
      data.domainType === 0 || data.domainType === 128
        ? 's.whatsapp.net'
        : 'lid';
  }
  return jidEncode(data.user, server, data.device);
}

export function TagReceiptNodeToReceiptEvent(
  node: BinaryNode,
  me: Me,
): ReceiptEvent[] {
  const { attrs, content } = node;
  const status = getStatusFromReceiptType(attrs.type);
  if (status == null) {
    return null;
  }

  const from = jidNormalizedUser(jid(attrs.from));
  const participant = jidNormalizedUser(jid(attrs.participant));
  const recipient = jidNormalizedUser(jid(attrs.recipient));

  const isLid = from.includes('lid');
  const isNodeFromMe = areJidsSameUser(
    participant || from,
    isLid ? me?.lid : me?.id,
  );
  const remoteJid = !isNodeFromMe || isJidGroup(from) ? from : recipient;
  const fromMe = !recipient || (attrs.type === 'retry' && isNodeFromMe);

  // basically, we only want to know when a message from us has been delivered to/read by the other person
  // or another device of ours has read some messages
  if (status < proto.WebMessageInfo.Status.SERVER_ACK && isNodeFromMe) {
    return [];
  }

  const key: proto.IMessageKey = {
    remoteJid: remoteJid,
    id: '',
    fromMe: fromMe,
  };

  const ids = [attrs.id];
  if (Array.isArray(content)) {
    const items = getBinaryNodeChildren(content[0], 'item');
    ids.push(...items.map((i) => i.attrs.id));
  }

  if (isJidGroup(remoteJid) || isJidStatusBroadcast(remoteJid)) {
    if (participant) {
      key.participant = fromMe ? (isLid ? me.lid : me.id) : recipient;
      const eventParticipant = fromMe ? participant : isLid ? me.lid : me.id;
      return [
        {
          key: key,
          messageIds: ids,
          status: status as any,
          participant: eventParticipant,
          _node: node,
        },
      ];
    } else {
      // Handle grouped receipts
      return handleGroupedReceipts(node, key, status, fromMe, isLid, me);
    }
  }

  return [
    {
      key: key,
      messageIds: ids,
      status: status as any,
      _node: node,
    },
  ];
}

function handleGroupedReceipts(
  node: BinaryNode,
  key: proto.IMessageKey,
  status: number,
  fromMe: boolean,
  isLid: boolean,
  me: Me,
): ReceiptEvent[] | null {
  const { content } = node;
  if (!Array.isArray(content)) {
    return [];
  }
  const participantsTags = content.filter((c) => c.tag === 'participants');
  if (participantsTags.length === 0) {
    return null;
  }

  const receiptEvents: ReceiptEvent[] = [];

  for (const participants of participantsTags) {
    const participantKey = participants.attrs?.key;
    if (!participantKey) continue;

    const users = getBinaryNodeChildren(participants, 'user');
    for (const user of users) {
      const userAttrs = user.attrs;
      if (!userAttrs) continue;

      const userJid = jidNormalizedUser(jid(userAttrs.jid));
      if (!userJid) continue;

      key.participant = fromMe ? (isLid ? me.lid : me.id) : userJid;
      const eventParticipant = fromMe ? userJid : isLid ? me.lid : me.id;
      const receiptEvent: ReceiptEvent = {
        key: {
          ...key,
          id: participantKey,
        },
        messageIds: [participantKey],
        status: status as any,
        participant: eventParticipant,
        _node: node,
      };

      receiptEvents.push(receiptEvent);
    }
  }

  return receiptEvents;
}
