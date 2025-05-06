import {
  aggregateMessageKeysNotFromMe,
  getContentType,
  getUrlFromDirectPath,
  isJidGroup,
  jidNormalizedUser,
  normalizeMessageContent,
} from '@adiwajshing/baileys';
import { isJidBroadcast } from '@adiwajshing/baileys/lib/WABinary/jid-utils';
import * as grpc from '@grpc/grpc-js';
import { connectivityState } from '@grpc/grpc-js';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  extractDeviceId,
  getChannelInviteLink,
  WhatsappSession,
} from '@waha/core/abc/session.abc';
import { Jid } from '@waha/core/engines/const';
import { EventsFromObservable } from '@waha/core/engines/gows/EventsFromObservable';
import { GowsEventStreamObservable } from '@waha/core/engines/gows/GowsEventStreamObservable';
import {
  ToGroupV2JoinEvent,
  ToGroupV2LeaveEvent,
  ToGroupV2ParticipantsEvents,
  ToGroupV2UpdateEvent,
} from '@waha/core/engines/gows/groups.gows';
import { messages } from '@waha/core/engines/gows/grpc/gows';
import {
  optional,
  parseJson,
  parseJsonList,
  statusToAck,
} from '@waha/core/engines/gows/helpers';
import { GowsAuthFactoryCore } from '@waha/core/engines/gows/store/GowsAuthFactoryCore';
import { toCusFormat } from '@waha/core/engines/noweb/session.noweb.core';
import { extractMediaContent } from '@waha/core/engines/noweb/utils';
import {
  AvailableInPlusVersion,
  NotImplementedByEngineError,
} from '@waha/core/exceptions';
import { IMediaEngineProcessor } from '@waha/core/media/IMediaEngineProcessor';
import { QR } from '@waha/core/QR';
import { ExtractMessageKeysForRead } from '@waha/core/utils/convertors';
import { parseMessageIdSerialized } from '@waha/core/utils/ids';
import { toJID } from '@waha/core/utils/jids';
import {
  Channel,
  ChannelListResult,
  ChannelMessage,
  ChannelRole,
  ChannelSearchByText,
  ChannelSearchByView,
  CreateChannelRequest,
  ListChannelsQuery,
  PreviewChannelMessages,
} from '@waha/structures/channels.dto';
import {
  ChatSortField,
  ChatSummary,
  GetChatMessageQuery,
  GetChatMessagesFilter,
  GetChatMessagesQuery,
  ReadChatMessagesQuery,
  ReadChatMessagesResponse,
} from '@waha/structures/chats.dto';
import {
  ChatRequest,
  CheckNumberStatusQuery,
  EditMessageRequest,
  MessageFileRequest,
  MessageForwardRequest,
  MessageImageRequest,
  MessageLinkCustomPreviewRequest,
  MessageLocationRequest,
  MessageReactionRequest,
  MessageReplyRequest,
  MessageTextRequest,
  MessageVoiceRequest,
  SendSeenRequest,
  WANumberExistResult,
} from '@waha/structures/chatting.dto';
import { ContactQuery } from '@waha/structures/contacts.dto';
import {
  ACK_UNKNOWN,
  WAHAEvents,
  WAHAPresenceStatus,
  WAHASessionStatus,
  WAMessageAck,
} from '@waha/structures/enums.dto';
import { BinaryFile, RemoteFile } from '@waha/structures/files.dto';
import {
  CreateGroupRequest,
  GroupSortField,
  Participant,
  ParticipantsRequest,
  SettingsSecurityChangeInfo,
} from '@waha/structures/groups.dto';
import { ReplyToMessage } from '@waha/structures/message.dto';
import { PaginationParams, SortOrder } from '@waha/structures/pagination.dto';
import {
  WAHAChatPresences,
  WAHAPresenceData,
} from '@waha/structures/presence.dto';
import {
  MessageSource,
  WAMessage,
  WAMessageReaction,
} from '@waha/structures/responses.dto';
import { MeInfo, ProxyConfig } from '@waha/structures/sessions.dto';
import {
  BROADCAST_ID,
  DeleteStatusRequest,
  TextStatus,
} from '@waha/structures/status.dto';
import { EnginePayload, WAMessageAckBody } from '@waha/structures/webhooks.dto';
import { PaginatorInMemory } from '@waha/utils/Paginator';
import { sleep, waitUntil } from '@waha/utils/promiseTimeout';
import { onlyEvent } from '@waha/utils/reactive/ops/onlyEvent';
import * as NodeCache from 'node-cache';
import {
  filter,
  merge,
  mergeMap,
  Observable,
  partition,
  retry,
  share,
} from 'rxjs';
import { map } from 'rxjs/operators';
import { promisify } from 'util';

import * as gows from './types';
import { MessageStatus } from './types';
import MessageServiceClient = messages.MessageServiceClient;
import { AckToStatus } from '@waha/core/utils/acks';
import { DistinctAck } from '@waha/core/utils/reactive';

enum WhatsMeowEvent {
  CONNECTED = 'gows.ConnectedEventData',
  DISCONNECTED = 'events.Disconnected',
  KEEP_ALIVE_TIMEOUT = 'events.KeepAliveTimeout',
  KEEP_ALIVE_RESTORED = 'events.KeepAliveRestored',
  QR_CHANNEL_ITEM = 'whatsmeow.QRChannelItem',
  MESSAGE = 'events.Message',
  RECEIPT = 'events.Receipt',
  PRESENCE = 'events.Presence',
  CHAT_PRESENCE = 'events.ChatPresence',
  PUSH_NAME_SETTING = 'events.PushNameSetting',
  LOGGED_OUT = 'events.LoggedOut',
  // Groups
  GROUP_INFO = 'events.GroupInfo',
  JOINED_GROUP = 'events.JoinedGroup',
}

const gRPCClientConfig = {
  'grpc.max_send_message_length': 128 * 1024 * 1024,
  'grpc.max_receive_message_length': 128 * 1024 * 1024,
};

export interface GowsConfig {
  connection: string;
}

export class WhatsappSessionGoWSCore extends WhatsappSession {
  protected authFactory = new GowsAuthFactoryCore();

  protected qr: QR;
  public client: MessageServiceClient;
  protected stream$: GowsEventStreamObservable;
  protected all$: Observable<EnginePayload>;
  protected events: EventsFromObservable<WhatsMeowEvent>;

  protected me: MeInfo | null;
  public session: messages.Session;
  protected presences: any;

  public constructor(config) {
    super(config);
    this.qr = new QR();
    this.session = new messages.Session({ id: this.name });
    this.presences = new NodeCache({
      stdTTL: 60 * 60, // 1 hour
      useClones: false,
    });
  }

  async start() {
    this.status = WAHASessionStatus.STARTING;
    this.buildStreams();
    this.subscribeEvents();
    this.subscribeEngineEvents2();
    if (this.isDebugEnabled()) {
      this.listenEngineEventsInDebugMode();
    }

    // start session
    const auth = await this.authFactory.buildAuth(this.sessionStore, this.name);

    const level = messages.LogLevel[this.logger.level.toUpperCase()];
    const request = new messages.StartSessionRequest({
      id: this.name,
      config: new messages.SessionConfig({
        store: new messages.SessionStoreConfig({
          address: auth.address(),
          dialect: auth.dialect(),
        }),
        log: new messages.SessionLogConfig({
          level: level ?? messages.LogLevel.INFO,
        }),
        proxy: new messages.SessionProxyConfig({
          url: this.getProxyUrl(this.proxyConfig),
        }),
      }),
    });

    this.client = new MessageServiceClient(
      this.engineConfig.connection,
      grpc.credentials.createInsecure(),
      gRPCClientConfig,
    );

    try {
      await promisify(this.client.StartSession)(request);
    } catch (err) {
      this.logger.error('Failed to start the client');
      this.logger.error(err, err.stack);
      this.status = WAHASessionStatus.FAILED;
      throw err;
    }
  }

  protected getProxyUrl(config: ProxyConfig): string {
    if (!config || !config.server) {
      return '';
    }
    const { server, username, password } = config;
    const auth = username && password ? `${username}:${password}@` : '';
    const schema = 'http';
    return `${schema}://${auth}${server}`;
  }

  buildStreams() {
    this.stream$ = new GowsEventStreamObservable(
      this.loggerBuilder.child({ grpc: 'stream' }),
      () => {
        const client = new messages.EventStreamClient(
          this.engineConfig.connection,
          grpc.credentials.createInsecure(),
          gRPCClientConfig,
        );
        const stream = client.StreamEvents(this.session);
        return { client, stream };
      },
    );

    // Retry on error with delay
    this.all$ = this.stream$.pipe(retry({ delay: 2_000 }), share());
  }

  subscribeEvents() {
    // Handle connection status
    this.events = new EventsFromObservable<WhatsMeowEvent>(this.all$);
    const events = this.events;
    events.on(WhatsMeowEvent.CONNECTED, (data) => {
      this.status = WAHASessionStatus.WORKING;
      this.me = {
        id: toCusFormat(jidNormalizedUser(data.ID)),
        pushName: data.PushName,
      };
      // @ts-ignore
      this.me.jid = data.ID;
    });

    events.on(WhatsMeowEvent.DISCONNECTED, () => {
      if (this.status != WAHASessionStatus.STARTING) {
        this.status = WAHASessionStatus.STARTING;
      }
    });
    events.on(WhatsMeowEvent.KEEP_ALIVE_TIMEOUT, () => {
      if (this.status != WAHASessionStatus.STARTING) {
        this.status = WAHASessionStatus.STARTING;
      }
    });
    events.on(WhatsMeowEvent.KEEP_ALIVE_RESTORED, () => {
      if (this.status != WAHASessionStatus.WORKING) {
        this.status = WAHASessionStatus.WORKING;
      }
    });
    events.on(WhatsMeowEvent.QR_CHANNEL_ITEM, async (data) => {
      if (!data.Event) {
        return;
      }
      if (data.Event == 'success') {
        return;
      }
      if (data.Event != 'code') {
        this.logger.warn(data, 'Failed QR item event');
        this.status = WAHASessionStatus.FAILED;
        return;
      }
      const qr = data.Code;
      if (!qr) {
        return;
      }
      this.qr.save(qr);
      this.printQR(this.qr);
      this.status = WAHASessionStatus.SCAN_QR_CODE;
    });
    events.on(WhatsMeowEvent.PUSH_NAME_SETTING, (data) => {
      this.me = { ...this.me, pushName: data.Action.name };
    });
    events.on(WhatsMeowEvent.LOGGED_OUT, () => {
      this.logger.error('Logged out');
      this.status = WAHASessionStatus.FAILED;
    });
    events.on(WhatsMeowEvent.PRESENCE, (event: gows.Presence) => {
      if (isJidGroup(event.From)) {
        // So group is not "online"
        return;
      }
      const Chat = event.From;
      const Sender = event.From;
      const stored = this.presences.get(Chat) || [];
      // remove values by event.Sender
      const filtered = stored.filter(
        (p) => p.Sender !== Sender && p.From !== Sender,
      );
      // add new value
      this.presences.set(Chat, [...filtered, event]);
    });
    events.on(WhatsMeowEvent.CHAT_PRESENCE, (event: gows.ChatPresence) => {
      const Chat = event.Chat;
      const Sender = event.Sender;
      const stored = this.presences.get(Chat) || [];
      // remove values by event.Sender
      const filtered = stored.filter(
        (p) => p.Sender !== Sender && p.From !== Sender,
      );
      // add new value
      this.presences.set(Chat, [...filtered, event]);
    });
    events.start();
  }

  subscribeEngineEvents2() {
    const all$ = this.all$;
    this.events2.get(WAHAEvents.ENGINE_EVENT).switch(all$);

    const messages$ = all$.pipe(onlyEvent(WhatsMeowEvent.MESSAGE));

    let [messagesFromMe$, messagesFromOthers$] = partition(messages$, isMine);
    messagesFromMe$ = messagesFromMe$.pipe(
      map((msg) => {
        msg.Status = MessageStatus.ServerAck;
        return msg;
      }),
      mergeMap((msg) => this.processIncomingMessage(msg, true)),
      share(), // share it so we don't process twice in message.any
    );
    messagesFromOthers$ = messagesFromOthers$.pipe(
      map((msg) => {
        msg.Status = MessageStatus.DeliveryAck;
        return msg;
      }),
      mergeMap((msg) => this.processIncomingMessage(msg, true)),
      share(), // share it so we don't process twice in message.any
    );
    const messagesFromAll$ = merge(messagesFromMe$, messagesFromOthers$);
    this.events2.get(WAHAEvents.MESSAGE).switch(messagesFromOthers$);
    this.events2.get(WAHAEvents.MESSAGE_ANY).switch(messagesFromAll$);

    const receipt$ = all$.pipe(onlyEvent(WhatsMeowEvent.RECEIPT));
    const messageAck$ = receipt$.pipe(
      mergeMap(this.receiptToMessageAck.bind(this)),
      DistinctAck(),
    );
    this.events2.get(WAHAEvents.MESSAGE_ACK).switch(messageAck$);

    const messageReactions$ = messages$.pipe(
      filter((msg) => !!msg?.Message?.reactionMessage),
      map(this.processMessageReaction.bind(this)),
    );
    this.events2.get(WAHAEvents.MESSAGE_REACTION).switch(messageReactions$);

    const presence$ = all$.pipe(
      onlyEvent(WhatsMeowEvent.PRESENCE),
      filter((event) => !isJidGroup(event.From)),
    );
    const chatPresence$ = all$.pipe(onlyEvent(WhatsMeowEvent.CHAT_PRESENCE));
    const presenceUpdates$ = merge(presence$, chatPresence$).pipe(
      map((event) => this.toWahaPresences(event.From || event.Chat, [event])),
    );
    this.events2.get(WAHAEvents.PRESENCE_UPDATE).switch(presenceUpdates$);
    //
    // Group Events
    //
    const joinedGroup$ = all$.pipe(onlyEvent(WhatsMeowEvent.JOINED_GROUP));
    const groupV2Join$ = joinedGroup$.pipe(map(ToGroupV2JoinEvent));
    this.events2.get(WAHAEvents.GROUP_V2_JOIN).switch(groupV2Join$);

    const groupInfo$ = all$.pipe(onlyEvent(WhatsMeowEvent.GROUP_INFO));

    const groupV2Leave$ = groupInfo$.pipe(
      map((event) => ToGroupV2LeaveEvent(this.me, event)),
      filter(Boolean),
    );
    this.events2.get(WAHAEvents.GROUP_V2_LEAVE).switch(groupV2Leave$);

    const groupV2Participants$ = groupInfo$.pipe(
      map(ToGroupV2ParticipantsEvents),
      mergeMap((events) => events),
    );
    this.events2
      .get(WAHAEvents.GROUP_V2_PARTICIPANTS)
      .switch(groupV2Participants$);

    const groupV2Update$ = groupInfo$.pipe(
      map(ToGroupV2UpdateEvent),
      filter(Boolean),
    );
    this.events2.get(WAHAEvents.GROUP_V2_UPDATE).switch(groupV2Update$);
  }

  async fetchContactProfilePicture(id: string): Promise<string> {
    const jid = toJID(this.ensureSuffix(id));
    const request = new messages.ProfilePictureRequest({
      jid: jid,
      session: this.session,
    });
    const response = await promisify(this.client.GetProfilePicture)(request);
    const url = response.toObject().url;
    return url;
  }

  protected listenEngineEventsInDebugMode() {
    this.events2.get(WAHAEvents.ENGINE_EVENT).subscribe((data) => {
      this.logger.debug({ events: data }, `GOWS event`);
    });
  }

  async stop(): Promise<void> {
    if (this.client) {
      const response = await promisify(this.client.StopSession)(this.session);
      response.toObject();
    }
    this.status = WAHASessionStatus.STOPPED;
    this.events?.stop();
    this.stopEvents();
    this.client?.close();
    this.mediaManager.close();
  }

  public async requestCode(phoneNumber: string, method: string, params?: any) {
    if (this.status == WAHASessionStatus.STARTING) {
      this.logger.debug('Waiting for connection update...');
      await waitUntil(
        async () => this.status === WAHASessionStatus.SCAN_QR_CODE,
        100,
        2000,
      );
    }

    if (this.status != WAHASessionStatus.SCAN_QR_CODE) {
      const err = `Can request code only in SCAN_QR_CODE status. The current status is ${this.status}`;
      throw new UnprocessableEntityException(err);
    }

    const request = new messages.PairCodeRequest({
      session: this.session,
      phone: phoneNumber,
    });
    const response = await promisify(this.client.RequestCode)(request);
    const code: string = response.toObject().code;
    this.logger.info(`Your code: ${code}`);
    return { code: code };
  }

  async unpair() {
    await promisify(this.client.Logout)(this.session);
  }

  public getSessionMeInfo(): MeInfo | null {
    return this.me;
  }

  /**
   * START - Methods for API
   */

  /**
   * Auth methods
   */
  public getQR(): QR {
    return this.qr;
  }

  async getScreenshot(): Promise<Buffer> {
    if (this.status === WAHASessionStatus.STARTING) {
      throw new UnprocessableEntityException(
        `The session is starting, please try again after few seconds`,
      );
    } else if (this.status === WAHASessionStatus.SCAN_QR_CODE) {
      return this.qr.get();
    } else if (this.status === WAHASessionStatus.WORKING) {
      throw new UnprocessableEntityException(
        `Can not get screenshot for non chrome based engine.`,
      );
    } else {
      throw new UnprocessableEntityException(`Unknown status - ${this.status}`);
    }
  }

  /**
   * Profile methods
   */
  public async setProfileName(name: string): Promise<boolean> {
    const request = new messages.ProfileNameRequest({
      session: this.session,
      name: name,
    });
    const response = await promisify(this.client.SetProfileName)(request);
    response.toObject();
    return true;
  }

  public async setProfileStatus(status: string): Promise<boolean> {
    const request = new messages.ProfileStatusRequest({
      session: this.session,
      status: status,
    });
    const response = await promisify(this.client.SetProfileStatus)(request);
    response.toObject();
    return true;
  }

  protected setProfilePicture(file: BinaryFile | RemoteFile): Promise<boolean> {
    throw new AvailableInPlusVersion();
  }

  protected deleteProfilePicture(): Promise<boolean> {
    throw new AvailableInPlusVersion();
  }

  /**
   * Other methods
   */
  async generateNewMessageId(): Promise<string> {
    const response = await promisify(this.client.GenerateNewMessageID)(
      this.session,
    );
    const data = response.toObject();
    return data.id;
  }

  async sendText(request: MessageTextRequest) {
    const jid = toJID(this.ensureSuffix(request.chatId));
    const message = new messages.MessageRequest({
      jid: jid,
      text: request.text,
      session: this.session,
      linkPreview: request.linkPreview ?? true,
      linkPreviewHighQuality: request.linkPreviewHighQuality,
      replyTo: getMessageIdFromSerialized(request.reply_to),
    });
    const response = await promisify(this.client.SendMessage)(message);
    const data = response.toObject();
    return this.messageResponse(jid, data);
  }

  public async editMessage(
    chatId: string,
    messageId: string,
    request: EditMessageRequest,
  ) {
    const jid = toJID(this.ensureSuffix(chatId));
    const key = parseMessageIdSerialized(messageId, true);
    const message = new messages.EditMessageRequest({
      session: this.session,
      jid: jid,
      messageId: key.id,
      text: request.text,
      linkPreview: request.linkPreview ?? true,
      linkPreviewHighQuality: request.linkPreviewHighQuality,
    });
    const response = await promisify(this.client.EditMessage)(message);
    const data = response.toObject();
    return this.messageResponse(jid, data);
  }

  public async deleteMessage(chatId: string, messageId: string) {
    const jid = toJID(this.ensureSuffix(chatId));
    const key = parseMessageIdSerialized(messageId);
    const message = new messages.RevokeMessageRequest({
      session: this.session,
      jid: jid,
      sender: key.participant || '',
      messageId: key.id,
    });
    const response = await promisify(this.client.RevokeMessage)(message);
    const data = response.toObject();
    return this.messageResponse(jid, data);
  }

  protected async prepareJidsForStatus(contacts: string[]) {
    if (!contacts || contacts.length == 0) {
      return [];
    }
    return contacts.map(toJID);
  }

  public async sendTextStatus(status: TextStatus) {
    const participants = await this.prepareJidsForStatus(status.contacts);
    const message = new messages.MessageRequest({
      id: status.id,
      jid: Jid.BROADCAST,
      participants: participants,
      text: status.text,
      session: this.session,
      backgroundColor: new messages.OptionalString({
        value: status.backgroundColor,
      }),
      font: new messages.OptionalUInt32({
        value: status.font,
      }),
      linkPreview: status.linkPreview ?? true,
      linkPreviewHighQuality: status.linkPreviewHighQuality,
    });
    const response = await promisify(this.client.SendMessage)(message);
    const data = response.toObject();
    return this.messageResponse(Jid.BROADCAST, data);
  }

  public async deleteStatus(request: DeleteStatusRequest) {
    const participants = await this.prepareJidsForStatus(request.contacts);
    const key = parseMessageIdSerialized(request.id, true);
    const message = new messages.RevokeMessageRequest({
      session: this.session,
      jid: BROADCAST_ID,
      sender: '',
      messageId: key.id,
      participants: participants,
    });
    const response = await promisify(this.client.RevokeMessage)(message);
    const data = response.toObject();
    return this.messageResponse(BROADCAST_ID, data);
  }

  protected messageResponse(jid, data) {
    const message = data.message ? parseJson(data.message) : null;
    const id = buildMessageId({
      ID: data.id,
      IsFromMe: true,
      IsGroup: isJidGroup(jid) || isJidBroadcast(jid),
      Chat: jid,
      Sender: this.me.id,
    });
    return {
      id: id,
      _data: message,
    };
  }

  async checkNumberStatus(
    request: CheckNumberStatusQuery,
  ): Promise<WANumberExistResult> {
    const req = new messages.CheckPhonesRequest({
      session: this.session,
      phones: [request.phone],
    });
    const response = await promisify(this.client.CheckPhones)(req);
    const data = response.toObject();
    const info = data.infos[0];
    return {
      numberExists: info.registered,
      chatId: toCusFormat(info.jid),
    };
  }

  sendLocation(request: MessageLocationRequest) {
    throw new Error('Method not implemented.');
  }

  forwardMessage(request: MessageForwardRequest): Promise<WAMessage> {
    throw new Error('Method not implemented.');
  }

  sendImage(request: MessageImageRequest) {
    throw new AvailableInPlusVersion();
  }

  sendFile(request: MessageFileRequest) {
    throw new AvailableInPlusVersion();
  }

  sendVoice(request: MessageVoiceRequest) {
    throw new AvailableInPlusVersion();
  }

  sendLinkCustomPreview(
    request: MessageLinkCustomPreviewRequest,
  ): Promise<any> {
    throw new AvailableInPlusVersion();
  }

  reply(request: MessageReplyRequest) {
    throw new Error('Method not implemented.');
  }

  async sendSeen(request: SendSeenRequest) {
    const keys = ExtractMessageKeysForRead(request);
    if (keys.length === 0) {
      return;
    }
    const receipts = aggregateMessageKeysNotFromMe(keys);
    for (const receipt of receipts) {
      if (receipt.messageIds.length === 0) {
        return;
      }
      const req = new messages.MarkReadRequest({
        session: this.session,
        jid: receipt.jid,
        messageIds: receipt.messageIds,
        sender: receipt.participant,
      });
      const response = await promisify(this.client.MarkRead)(req);
      response.toObject();
    }
    return;
  }

  startTyping(chat: ChatRequest) {
    return this.setPresence(WAHAPresenceStatus.TYPING, chat.chatId);
  }

  stopTyping(chat: ChatRequest) {
    return this.setPresence(WAHAPresenceStatus.PAUSED, chat.chatId);
  }

  /**
   * Group methods
   */
  public async createGroup(request: CreateGroupRequest) {
    const req = new messages.CreateGroupRequest({
      session: this.session,
      name: request.name,
      participants: request.participants.map((p) => toJID(p.id)),
    });
    const response = await promisify(this.client.CreateGroup)(req);
    const data = parseJson(response);
    return data;
  }

  public async joinInfoGroup(code: string): Promise<any> {
    const req = new messages.GroupCodeRequest({
      session: this.session,
      code: code,
    });
    const response = await promisify(this.client.GetGroupInfoFromLink)(req);
    const data = parseJson(response);
    return data;
  }

  public async joinGroup(code: string): Promise<string> {
    const req = new messages.GroupCodeRequest({
      session: this.session,
      code: code,
    });
    const response = await promisify(this.client.JoinGroupWithLink)(req);
    const data = parseJson(response);
    return data.jid;
  }

  public async getGroups(pagination: PaginationParams) {
    const req = this.session;
    const response = await promisify(this.client.GetGroups)(req);
    const data = parseJsonList(response);
    switch (pagination.sortBy) {
      case GroupSortField.ID:
        pagination.sortBy = 'JID';
        break;
      case GroupSortField.SUBJECT:
        pagination.sortBy = 'Name';
        break;
    }
    const paginator = new PaginatorInMemory(pagination);
    return paginator.apply(data);
  }

  protected removeGroupsFieldParticipant(group: any) {
    delete group.Participants;
  }

  public async refreshGroups(): Promise<boolean> {
    const req = this.session;
    await promisify(this.client.FetchGroups)(req);
    return true;
  }

  public async getGroup(id) {
    const req = new messages.JidRequest({
      session: this.session,
      jid: id,
    });
    const response = await promisify(this.client.GetGroupInfo)(req);
    const data = parseJson(response);
    return data;
  }

  public async getInfoAdminsOnly(id): Promise<SettingsSecurityChangeInfo> {
    const group = await this.getGroup(id);
    return {
      adminsOnly: group.IsLocked,
    };
  }

  public async setInfoAdminsOnly(id, value) {
    const req = new messages.JidBoolRequest({
      session: this.session,
      jid: id,
      value: value,
    });
    await promisify(this.client.SetGroupLocked)(req);
    return;
  }

  public async getMessagesAdminsOnly(id): Promise<SettingsSecurityChangeInfo> {
    const group = await this.getGroup(id);
    return {
      adminsOnly: group.IsAnnounce,
    };
  }

  public async setMessagesAdminsOnly(id, value) {
    const req = new messages.JidBoolRequest({
      session: this.session,
      jid: id,
      value: value,
    });
    await promisify(this.client.SetGroupAnnounce)(req);
    return;
  }

  public deleteGroup(id) {
    throw new NotImplementedByEngineError();
  }

  public async leaveGroup(id) {
    const req = new messages.JidRequest({
      session: this.session,
      jid: id,
    });
    await promisify(this.client.LeaveGroup)(req);
  }

  public async setDescription(id, description) {
    const req = new messages.JidStringRequest({
      session: this.session,
      jid: id,
      value: description,
    });
    await promisify(this.client.SetGroupDescription)(req);
  }

  public async setSubject(id, description) {
    const req = new messages.JidStringRequest({
      session: this.session,
      jid: id,
      value: description,
    });
    await promisify(this.client.SetGroupName)(req);
  }

  public async getInviteCode(id): Promise<string> {
    const req = new messages.JidRequest({
      session: this.session,
      jid: id,
    });
    const response = await promisify(this.client.GetGroupInviteLink)(req);
    const data = response.toObject();
    return data.value;
  }

  public async revokeInviteCode(id): Promise<string> {
    const req = new messages.JidRequest({
      session: this.session,
      jid: id,
    });
    const response = await promisify(this.client.RevokeGroupInviteLink)(req);
    const data = response.toObject();
    return data.value;
  }

  public async getParticipants(id) {
    const group = await this.getGroup(id);
    return group.Participants;
  }

  private async updateParticipants(
    id: string,
    participants: Array<Participant>,
    action: messages.ParticipantAction,
  ): Promise<any> {
    const jids = participants.map((p) => toJID(p.id));
    const req = new messages.UpdateParticipantsRequest({
      session: this.session,
      jid: id,
      participants: jids,
      action: action,
    });
    const response = await promisify(this.client.UpdateGroupParticipants)(req);
    const data = parseJsonList(response);
    return data;
  }

  public addParticipants(id: string, request: ParticipantsRequest) {
    const action = messages.ParticipantAction.ADD;
    return this.updateParticipants(id, request.participants, action);
  }

  public removeParticipants(id, request: ParticipantsRequest) {
    const action = messages.ParticipantAction.REMOVE;
    return this.updateParticipants(id, request.participants, action);
  }

  public promoteParticipantsToAdmin(id, request: ParticipantsRequest) {
    const action = messages.ParticipantAction.PROMOTE;
    return this.updateParticipants(id, request.participants, action);
  }

  public demoteParticipantsToUser(id, request: ParticipantsRequest) {
    const action = messages.ParticipantAction.DEMOTE;
    return this.updateParticipants(id, request.participants, action);
  }

  async setReaction(request: MessageReactionRequest) {
    const key = parseMessageIdSerialized(request.messageId);
    const message = new messages.MessageReaction({
      session: this.session,
      jid: key.remoteJid,
      messageId: key.id,
      reaction: request.reaction,
      sender: key.fromMe ? this.me.id : key.participant || key.remoteJid,
    });
    const response = await promisify(this.client.SendReaction)(message);
    const data = response.toObject();
    return this.messageResponse(key.remoteJid, data);
  }

  public async setPresence(presence: WAHAPresenceStatus, chatId?: string) {
    let request: any;
    let method: any;
    const jid = chatId ? toJID(this.ensureSuffix(chatId)) : null;
    switch (presence) {
      case WAHAPresenceStatus.ONLINE:
        request = new messages.PresenceRequest({
          session: this.session,
          status: messages.Presence.AVAILABLE,
        });
        method = this.client.SendPresence;
        break;
      case WAHAPresenceStatus.OFFLINE:
        request = new messages.PresenceRequest({
          session: this.session,
          status: messages.Presence.UNAVAILABLE,
        });
        method = this.client.SendPresence;
        break;
      case WAHAPresenceStatus.TYPING:
        request = new messages.ChatPresenceRequest({
          session: this.session,
          jid: jid,
          status: messages.ChatPresence.TYPING,
        });
        method = this.client.SendChatPresence;
        break;
      case WAHAPresenceStatus.RECORDING:
        request = new messages.ChatPresenceRequest({
          session: this.session,
          jid: jid,
          status: messages.ChatPresence.RECORDING,
        });
        method = this.client.SendChatPresence;
        break;
      case WAHAPresenceStatus.PAUSED:
        request = new messages.ChatPresenceRequest({
          session: this.session,
          jid: jid,
          status: messages.ChatPresence.PAUSED,
        });
        method = this.client.SendChatPresence;
        break;

      default:
        throw new Error('Invalid presence status');
    }
    await promisify(method)(request);
  }

  public async getPresences(): Promise<WAHAChatPresences[]> {
    const result: WAHAChatPresences[] = [];
    for (const remoteJid in this.presences.keys()) {
      const storedPresences = this.presences.get(remoteJid);
      result.push(this.toWahaPresences(remoteJid, storedPresences));
    }
    return result;
  }

  public async getPresence(chatId: string): Promise<WAHAChatPresences> {
    const remoteJid = toJID(chatId);
    if (!(remoteJid in this.presences.keys())) {
      await this.subscribePresence(remoteJid);
      await sleep(1000);
    }
    const result = this.presences.get(remoteJid) || [];
    return this.toWahaPresences(remoteJid, result);
  }

  async subscribePresence(chatId: string) {
    const jid = toJID(chatId);
    const req = new messages.SubscribePresenceRequest({
      session: this.session,
      jid: jid,
    });
    const response = await promisify(this.client.SubscribePresence)(req);
    return response.toObject();
  }

  protected toWahaPresenceData(
    data: gows.Presence | gows.ChatPresence,
  ): WAHAPresenceData {
    if ('From' in data) {
      data = data as gows.Presence;
      const lastKnownPresence = data.Unavailable
        ? WAHAPresenceStatus.OFFLINE
        : WAHAPresenceStatus.ONLINE;
      return {
        participant: toCusFormat(data.From),
        lastKnownPresence: lastKnownPresence,
        lastSeen: parseTimestampToSeconds(data.LastSeen),
      };
    }

    data = data as gows.ChatPresence;
    let lastKnownPresence: WAHAPresenceStatus;
    if (data.State === gows.ChatPresenceState.PAUSED) {
      lastKnownPresence = WAHAPresenceStatus.PAUSED;
    } else if (
      data.State === gows.ChatPresenceState.COMPOSING &&
      data.Media === gows.ChatPresenceMedia.TEXT
    ) {
      lastKnownPresence = WAHAPresenceStatus.TYPING;
    } else if (
      data.State === gows.ChatPresenceState.COMPOSING &&
      data.Media === gows.ChatPresenceMedia.AUDIO
    ) {
      lastKnownPresence = WAHAPresenceStatus.RECORDING;
    }
    return {
      participant: toCusFormat(data.Sender),
      lastKnownPresence: lastKnownPresence,
      lastSeen: null,
    };
  }

  protected toWahaPresences(
    jid,
    result: null | gows.Presence[] | gows.ChatPresence[],
  ): WAHAChatPresences {
    const chatId = toCusFormat(jid);
    return {
      id: chatId,
      presences: result?.map(this.toWahaPresenceData.bind(this)),
    };
  }

  /**
   * Channels methods
   */
  public searchChannelsByView(
    query: ChannelSearchByView,
  ): Promise<ChannelListResult> {
    throw new AvailableInPlusVersion();
  }

  public searchChannelsByText(
    query: ChannelSearchByText,
  ): Promise<ChannelListResult> {
    throw new AvailableInPlusVersion();
  }

  public async previewChannelMessages(
    inviteCode: string,
    query: PreviewChannelMessages,
  ): Promise<ChannelMessage[]> {
    throw new AvailableInPlusVersion();
  }

  protected toChannel(newsletter: messages.Newsletter): Channel {
    const role: ChannelRole =
      (newsletter.role?.toUpperCase() as ChannelRole) || ChannelRole.GUEST;
    let picture = newsletter.picture;
    if (picture.startsWith('/')) {
      picture = getUrlFromDirectPath(picture);
    }
    let preview = newsletter.preview;
    if (preview.startsWith('/')) {
      preview = getUrlFromDirectPath(preview);
    }
    return {
      id: newsletter.id,
      name: newsletter.name,
      description: newsletter.description,
      invite: getChannelInviteLink(newsletter.invite),
      picture: picture,
      preview: preview,
      verified: newsletter.verified,
      role: role,
      subscribersCount: newsletter.subscriberCount,
    };
  }

  public async channelsList(query: ListChannelsQuery): Promise<Channel[]> {
    const request = new messages.NewsletterListRequest({
      session: this.session,
    });
    const response = await promisify(this.client.GetSubscribedNewsletters)(
      request,
    );
    const data = response.toObject();
    const newsletters = data.newsletters;
    let channels: Channel[] = newsletters.map(this.toChannel.bind(this));
    if (query.role) {
      // @ts-ignore
      channels = channels.filter((channel) => channel.role === query.role);
    }
    return channels;
  }

  public async channelsCreateChannel(
    request: CreateChannelRequest,
  ): Promise<Channel> {
    const req = new messages.CreateNewsletterRequest({
      session: this.session,
      name: request.name,
      description: request.description,
    });
    const response = await promisify(this.client.CreateNewsletter)(req);
    const newsletter = response.toObject() as messages.Newsletter;
    return this.toChannel(newsletter);
  }

  public async channelsGetChannel(id: string): Promise<Channel> {
    return await this.channelsGetChannelByInviteCode(id);
  }

  public async channelsGetChannelByInviteCode(
    inviteCode: string,
  ): Promise<Channel> {
    const request = new messages.NewsletterInfoRequest({
      session: this.session,
      id: inviteCode,
    });
    const response = await promisify(this.client.GetNewsletterInfo)(request);
    const newsletter = response.toObject() as messages.Newsletter;
    return this.toChannel(newsletter);
  }

  public channelsFollowChannel(id: string): Promise<any> {
    return this.channelsToggleFollow(id, true);
  }

  public channelsUnfollowChannel(id: string): Promise<any> {
    return this.channelsToggleFollow(id, false);
  }

  protected async channelsToggleFollow(id: string, follow: boolean) {
    const request = new messages.NewsletterToggleFollowRequest({
      session: this.session,
      jid: id,
      follow: follow,
    });
    const response = await promisify(this.client.NewsletterToggleFollow)(
      request,
    );
    return response.toObject();
  }

  public channelsMuteChannel(id: string): Promise<void> {
    return this.channelsToggleMute(id, true);
  }

  public channelsUnmuteChannel(id: string): Promise<void> {
    return this.channelsToggleMute(id, false);
  }

  protected async channelsToggleMute(id: string, mute: boolean): Promise<any> {
    const request = new messages.NewsletterToggleMuteRequest({
      session: this.session,
      jid: id,
      mute: mute,
    });
    const response = await promisify(this.client.NewsletterToggleMute)(request);
    return response.toObject();
  }

  /**
   * Contacts methods
   */

  protected toWAContact(contact) {
    return {
      id: toCusFormat(contact.Jid),
      name: contact.Name,
      pushname: contact.PushName,
    };
  }

  public async getContact(query: ContactQuery) {
    const jid = toJID(query.contactId);
    const request = new messages.EntityByIdRequest({
      session: this.session,
      id: jid,
    });
    const response = await promisify(this.client.GetContactById)(request);
    const data = parseJson(response);
    return this.toWAContact(data);
  }

  public async getContacts(pagination: PaginationParams) {
    const request = new messages.GetContactsRequest({
      session: this.session,
      pagination: new messages.Pagination({
        limit: pagination.limit,
        offset: pagination.offset,
      }),
      sortBy: new messages.SortBy({
        field: pagination.sortBy || 'id',
        order:
          pagination.sortOrder === SortOrder.DESC
            ? messages.SortBy.Order.DESC
            : messages.SortBy.Order.ASC,
      }),
    });
    const response = await promisify(this.client.GetContacts)(request);
    const data = parseJsonList(response);
    return data.map(this.toWAContact.bind(this));
  }

  /**
   * Chats methods
   */
  public async getChatsOverview(
    pagination: PaginationParams,
  ): Promise<ChatSummary[]> {
    if (!pagination.sortBy) {
      pagination.sortBy = 'timestamp';
    }
    if (!pagination.sortOrder) {
      pagination.sortOrder = SortOrder.DESC;
    }
    const chats = await this.getChats(pagination);

    const promises = [];
    for (const chat of chats) {
      promises.push(this.fetchChatSummary(chat));
    }
    const result = await Promise.all(promises);
    return result;
  }

  protected async fetchChatSummary(chat): Promise<ChatSummary> {
    const id = toCusFormat(chat.id);
    const name = chat.name;
    const picture = await this.getContactProfilePicture(chat.id, false);
    const messages = await this.getChatMessages(
      chat.id,
      { limit: 1, offset: 0, downloadMedia: false },
      {},
    );
    const message = messages.length > 0 ? messages[0] : null;
    return {
      id: id,
      name: name || null,
      picture: picture,
      lastMessage: message,
      _chat: chat,
    };
  }

  protected toWAChat(chat) {
    return {
      id: toCusFormat(chat.Jid),
      name: chat.Name,
      conversationTimestamp: parseTimestampToSeconds(
        chat.ConversationTimestamp,
      ),
    };
  }

  public async getChats(pagination: PaginationParams) {
    if (pagination.sortBy === ChatSortField.CONVERSATION_TIMESTAMP) {
      pagination.sortBy = 'timestamp';
    }
    const request = new messages.GetChatsRequest({
      session: this.session,
      pagination: new messages.Pagination({
        limit: pagination.limit,
        offset: pagination.offset,
      }),
      sortBy: new messages.SortBy({
        field: pagination.sortBy || 'id',
        order:
          pagination.sortOrder === SortOrder.DESC
            ? messages.SortBy.Order.DESC
            : messages.SortBy.Order.ASC,
      }),
    });
    const response = await promisify(this.client.GetChats)(request);
    const data = parseJsonList(response);
    return data.map(this.toWAChat.bind(this));
  }

  public async getChatMessages(
    chatId: string,
    query: GetChatMessagesQuery,
    filter: GetChatMessagesFilter,
  ) {
    const downloadMedia = query.downloadMedia;
    let jid: messages.OptionalString;
    if (chatId === 'all') {
      jid = null;
    } else {
      jid = new messages.OptionalString({
        value: toJID(this.ensureSuffix(chatId)),
      });
    }

    const status =
      filter['filter.ack'] != null ? AckToStatus(filter['filter.ack']) : null;
    const request = new messages.GetMessagesRequest({
      session: this.session,
      filters: new messages.MessageFilters({
        jid: jid,
        timestampGte: optional(
          filter['filter.timestamp.gte'],
          messages.OptionalUInt64,
        ),
        timestampLte: optional(
          filter['filter.timestamp.lte'],
          messages.OptionalUInt64,
        ),
        fromMe: optional(filter['filter.fromMe'], messages.OptionalBool),
        status: optional(status, messages.OptionalUInt32),
      }),
      pagination: new messages.Pagination({
        limit: query.limit,
        offset: query.offset,
      }),
    });
    const response = await promisify(this.client.GetMessages)(request);
    const msgs = parseJsonList(response);
    const promises = [];
    for (const msg of msgs) {
      promises.push(this.processIncomingMessage(msg, downloadMedia));
    }
    let result = await Promise.all(promises);
    result = result.filter(Boolean);
    return result;
  }

  public readChatMessages(
    chatId: string,
    request: ReadChatMessagesQuery,
  ): Promise<ReadChatMessagesResponse> {
    return this.readChatMessagesWSImpl(chatId, request);
  }

  public async getChatMessage(
    chatId: string,
    messageId: string,
    query: GetChatMessageQuery,
  ): Promise<null | WAMessage> {
    const key = parseMessageIdSerialized(messageId, true);
    const request = new messages.EntityByIdRequest({
      session: this.session,
      id: key.id,
    });
    const response = await promisify(this.client.GetMessageById)(request);
    const msg = parseJson(response);
    return this.processIncomingMessage(msg, query.downloadMedia);
  }

  //
  // END - Methods for API
  //

  protected async processIncomingMessage(message, downloadMedia = true) {
    // if there is no text or media message
    if (!message) return;
    if (!message.Message) return;
    // Ignore reactions, we have dedicated handler for that
    if (message.Message.reactionMessage) return;
    // Ignore poll votes, we have dedicated handler for that
    if (message.Message.pollUpdateMessage) return;
    // Ignore protocol messages
    if (message.Message.protocolMessage) return;

    const normalizedContent = normalizeMessageContent(message.Message);
    const hasSomeContent = !!getContentType(normalizedContent);
    if (!hasSomeContent) {
      // Ignore key distribution messages
      if (message.message.senderKeyDistributionMessage) return;
    }

    if (downloadMedia) {
      try {
        message = await this.downloadMedia(message);
      } catch (e) {
        this.logger.error('Failed when tried to download media for a message');
        this.logger.error(e, e.stack);
      }
    }
    return this.toWAMessage(message);
  }

  protected downloadMedia(message) {
    const processor = new GOWSEngineMediaProcessor(this);
    return this.mediaManager.processMedia(processor, message, this.name);
  }

  protected toWAMessage(message): WAMessage {
    const fromToParticipant = getFromToParticipant(message);
    const id = buildMessageId(message);
    const body = this.extractBody(message.Message);
    const replyTo = this.extractReplyTo(message.Message);
    let ack = statusToAck(message.Status);
    if (ack === WAMessageAck.ERROR) {
      // GOWS error because of how golang treats it as null
      // It'll be UNKNOWN instead of ERROR
      ack = null;
    }
    const mediaContent = extractMediaContent(message.Message);
    const source = this.getSourceDeviceByMsg(message);

    return {
      id: id,
      timestamp: parseTimestampToSeconds(message.Info.Timestamp),
      from: toCusFormat(fromToParticipant.from),
      fromMe: message.Info.IsFromMe,
      source: source,
      body: body,
      to: toCusFormat(fromToParticipant.to),
      participant: toCusFormat(fromToParticipant.participant),
      // Media
      hasMedia: Boolean(mediaContent),
      media: message.media || null,
      mediaUrl: message.media?.url,
      // @ts-ignore
      ack: ack,
      // @ts-ignore
      ackName: WAMessageAck[ack] || ACK_UNKNOWN,
      replyTo: replyTo,
      _data: message,
    };
  }

  private getSourceDeviceByMsg(message): MessageSource {
    if (!message.Info.IsFromMe) {
      return MessageSource.APP;
    }
    // @ts-ignore
    const myJid = this.me.jid;
    const myDeviceId = extractDeviceId(myJid);
    const sentDeviceId = extractDeviceId(message.Info.Sender);
    return sentDeviceId === myDeviceId ? MessageSource.API : MessageSource.APP;
  }

  private extractBody(message) {
    if (!message) {
      return null;
    }
    let body = message.Conversation || message.conversation;
    if (!body) {
      body = message.extendedTextMessage?.text;
    }
    if (!body) {
      const media = extractMediaContent(message);
      body = media?.caption;
    }
    return body;
  }

  protected extractReplyTo(message): ReplyToMessage | null {
    const msgType = getContentType(message);
    const contextInfo = message[msgType]?.contextInfo;
    if (!contextInfo) {
      return null;
    }
    const quotedMessage = contextInfo.quotedMessage;
    if (!quotedMessage) {
      return null;
    }
    const body = this.extractBody(quotedMessage);
    return {
      id: contextInfo.stanzaID,
      participant: toCusFormat(contextInfo.participant),
      body: body,
      _data: quotedMessage,
    };
  }

  public async getEngineInfo() {
    const clientState = this.client?.getChannel().getConnectivityState(false);
    const streamState = this.stream$?.client
      ?.getChannel()
      .getConnectivityState(false);
    const grpc = {
      client: connectivityState[clientState] || 'NO_CLIENT',
      stream: connectivityState[streamState] || 'NO_STREAM',
    };
    if (!this.client) {
      return {
        grpc: grpc,
      };
    }

    let gows;
    try {
      const response = await promisify(this.client.GetSessionState)(
        this.session,
      );
      const info = response.toObject();
      gows = { ...info };
    } catch (err) {
      gows = { error: err };
    }
    return {
      grpc: grpc,
      gows: gows,
    };
  }

  receiptToMessageAck(receipt: any): WAMessageAckBody[] {
    const fromToParticipant = getFromToParticipant(receipt);

    let ack;
    switch (receipt.Type) {
      case '':
        ack = WAMessageAck.DEVICE;
        break;
      case 'server-error':
        ack = WAMessageAck.ERROR;
        break;
      case 'inactive':
        ack = WAMessageAck.DEVICE;
        break;
      case 'active':
        ack = WAMessageAck.DEVICE;
        break;
      case 'read':
        ack = WAMessageAck.READ;
        break;
      case 'played':
        ack = WAMessageAck.PLAYED;
        break;
      default:
        return [];
    }
    const acks = [];
    for (const messageId of receipt.MessageIDs) {
      const msg = {
        ...receipt,
        ID: messageId,
        // Reverse the IsFromMe flag
        IsFromMe: !receipt.IsFromMe,
        Sender: receipt.MessageSender || this.me?.id,
      };
      const id = buildMessageId(msg);
      const body: WAMessageAckBody = {
        id: id,
        from: toCusFormat(fromToParticipant.from),
        to: toCusFormat(fromToParticipant.to),
        participant: toCusFormat(fromToParticipant.participant),
        fromMe: msg.IsFromMe,
        ack: ack,
        ackName: WAMessageAck[ack] || ACK_UNKNOWN,
        _data: receipt,
      };
      acks.push(body);
    }
    return acks;
  }

  private processMessageReaction(message): WAMessageReaction | null {
    if (!message) return null;
    if (!message.Message) return null;
    if (!message.Message.reactionMessage) return null;

    const id = buildMessageId(message);
    const fromToParticipant = getFromToParticipant(message);
    const reactionMessage = message.Message.reactionMessage;
    const messageId = this.buildMessageIdFromKey(reactionMessage.key);
    const source = this.getSourceDeviceByMsg(message);
    const reaction: WAMessageReaction = {
      id: id,
      timestamp: parseTimestampToSeconds(message.Info.Timestamp),
      from: toCusFormat(fromToParticipant.from),
      fromMe: message.Info.IsFromMe,
      source: source,
      to: toCusFormat(fromToParticipant.to),
      participant: toCusFormat(fromToParticipant.participant),
      reaction: {
        text: reactionMessage.text,
        messageId: messageId,
      },
    };
    return reaction;
  }

  buildMessageIdFromKey(key: WARawKey) {
    const sender = key.fromMe ? this.me.id : key.participant || key.remoteJID;
    const info: MessageIdData = {
      Chat: key.remoteJID,
      Sender: sender,
      ID: key.ID,
      IsFromMe: key.fromMe,
      IsGroup: isJidGroup(key.remoteJID),
    };
    return buildMessageId(info);
  }
}

export class GOWSEngineMediaProcessor implements IMediaEngineProcessor<any> {
  constructor(public session: WhatsappSessionGoWSCore) {}

  hasMedia(message: any): boolean {
    return Boolean(extractMediaContent(message.Message));
  }

  getChatId(message: any): string {
    return toCusFormat(message.Info.Chat);
  }

  getMessageId(message: any): string {
    return message.Info.ID;
  }

  getMimetype(message: any): string {
    const content = extractMediaContent(message.Message);
    return content.mimetype;
  }

  async getMediaBuffer(message: any): Promise<Buffer | null> {
    const data = JSON.stringify(message.Message);
    const request = new messages.DownloadMediaRequest({
      // double "session" it's not a mistake here
      session: this.session.session,
      message: data,
    });
    const response = await promisify(this.session.client.DownloadMedia)(
      request,
    );
    const obj = response.toObject();
    return Buffer.from(obj.content);
  }

  getFilename(message: any): string | null {
    const content = extractMediaContent(message.Message);
    return content?.fileName;
  }
}

function isMine(message) {
  return !!message.Info.IsFromMe;
}

function getFromToParticipant(message) {
  const info = message.Info || message;
  return {
    from: info.Chat,
    to: info.IsGroup ? info.Sender : null,
    participant: info.IsGroup ? info.Sender : null,
  };
}

interface MessageIdData {
  Info?: MessageIdData;
  Chat: string;
  Sender: string;
  ID: string;
  IsFromMe: boolean;
  IsGroup: boolean;
}

function buildMessageId(message: MessageIdData) {
  const info = message.Info || message;
  const chatId = toCusFormat(info.Chat);
  const participant = toCusFormat(info.Sender);
  if (info.IsGroup) {
    return `${info.IsFromMe}_${chatId}_${info.ID}_${participant}`;
  }
  return `${info.IsFromMe}_${chatId}_${info.ID}`;
}

interface WARawKey {
  remoteJID: string;
  fromMe: boolean;
  ID: string;
  participant?: string;
}

function parseTimestamp(timestamp: string): number {
  if (timestamp.startsWith('0001')) {
    return null;
  }
  // "2024-12-25T14:28:42+03:00" => 1234567890
  return new Date(timestamp).getTime();
}

function parseTimestampToSeconds(timestamp: string): number {
  const ms = parseTimestamp(timestamp);
  if (!ms) {
    return ms;
  }
  return Math.floor(ms / 1000);
}

export function getMessageIdFromSerialized(serialized: string): string | null {
  if (!serialized) {
    return null;
  }
  const key = parseMessageIdSerialized(serialized, true);
  return key.id;
}
