import { GetChatMessagesFilter } from '@waha/structures/chats.dto';
import { Label } from '@waha/structures/labels.dto';
import { PaginationParams } from '@waha/structures/pagination.dto';
import { TextStatus } from '@waha/structures/status.dto';
import { EventEmitter } from 'events';
import * as lodash from 'lodash';
import { Page } from 'puppeteer';
import { Client, Events } from 'whatsapp-web.js';
import { Message } from 'whatsapp-web.js/src/structures';
import { exposeFunctionIfAbsent } from 'whatsapp-web.js/src/util/Puppeter';

import { CallErrorEvent, PAGE_CALL_ERROR_EVENT, WPage } from './WPage';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadWAHA } = require('./_WAHA.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadLodash } = require('./_lodash.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadPaginator } = require('./_Paginator.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ChatFactory = require('whatsapp-web.js/src/factories/ChatFactory');

export class WebjsClientCore extends Client {
  public events = new EventEmitter();
  private wpage: WPage = null;

  constructor(options) {
    super(options);
    // Wait until it's READY and inject more utils
    this.on(Events.READY, async () => {
      await this.attachCustomEventListeners();
      await this.injectWaha();
    });
  }

  async initialize() {
    const result = await super.initialize();
    if (this.pupPage && !(this.pupPage instanceof WPage)) {
      this.wpage = new WPage(this.pupPage);
      this.wpage.on(PAGE_CALL_ERROR_EVENT as any, (event: CallErrorEvent) => {
        this.events.emit(PAGE_CALL_ERROR_EVENT as any, event);
      });
      this.pupPage = this.wpage as any as Page;
    }
    return result;
  }

  async injectWaha() {
    await this.pupPage.evaluate(LoadLodash);
    await this.pupPage.evaluate(LoadPaginator);
    await this.pupPage.evaluate(LoadWAHA);
  }

  async attachCustomEventListeners() {
    await exposeFunctionIfAbsent(
      this.pupPage,
      'onNewMessageId',
      (messageId: string) => {
        this.events.emit('message.id', { id: messageId });
        return;
      },
    );
  }

  async destroy() {
    this.events.removeAllListeners();
    this.wpage?.removeAllListeners();
    await super.destroy();
  }

  async setPushName(name: string) {
    await this.pupPage.evaluate(async (pushName) => {
      return await window['WAHA'].WAWebSetPushnameConnAction.setPushname(
        pushName,
      );
    }, name);
    if (this.info) {
      this.info.pushname = name;
    }
  }

  async unpair() {
    await this.pupPage.evaluate(async () => {
      if (
        // @ts-ignore
        window.Store &&
        // @ts-ignore
        window.Store.AppState &&
        // @ts-ignore
        typeof window.Store.AppState.logout === 'function'
      ) {
        // @ts-ignore
        await window.Store.AppState.logout();
      }
    });
  }

  async createLabel(name: string, color: number): Promise<number> {
    const labelId: number = await this.pupPage.evaluate(
      async (name, color) => {
        // @ts-ignore
        return await window.WAHA.WAWebBizLabelEditingAction.labelAddAction(
          name,
          color,
        );
      },
      name,
      color,
    );
    return labelId;
  }

  async deleteLabel(label: Label) {
    return await this.pupPage.evaluate(async (label) => {
      // @ts-ignore
      return await window.WAHA.WAWebBizLabelEditingAction.labelDeleteAction(
        label.id,
        label.name,
        label.color,
      );
    }, label);
  }

  async updateLabel(label: Label) {
    return await this.pupPage.evaluate(async (label) => {
      // @ts-ignore
      return await window.WAHA.WAWebBizLabelEditingAction.labelEditAction(
        label.id,
        label.name,
        undefined, // predefinedId
        label.color,
      );
    }, label);
  }

  async getChats(pagination?: PaginationParams) {
    if (lodash.isEmpty(pagination)) {
      return await super.getChats();
    }

    // Get paginated chats
    pagination.limit ||= Infinity;
    pagination.offset ||= 0;

    const chats = await this.pupPage.evaluate(async (pagination) => {
      // @ts-ignore
      return await window.WAHA.getChats(pagination);
    }, pagination);

    return chats.map((chat) => ChatFactory.create(this, chat));
  }

  async sendTextStatus(status: TextStatus) {
    // Convert from hex to number
    const waColor = 'FF' + status.backgroundColor.replace('#', '');
    const color = parseInt(waColor, 16);

    const textStatus = {
      text: status.text,
      color: color,
      font: status.font,
    };
    const sentMsg = await this.pupPage.evaluate(async (status) => {
      // @ts-ignore
      await window.Store.SendStatus.sendStatusTextMsgAction(status);
      // @ts-ignore
      const meUser = window.Store.User.getMeUser();
      // @ts-ignore
      const myStatus = window.Store.Status.getModelsArray().findLast(
        (x) => x.id == meUser,
      );
      if (!myStatus) {
        return undefined;
      }
      // @ts-ignore
      const msg = myStatus.msgs.last();
      // @ts-ignore
      return msg ? window.WWebJS.getMessageModel(msg) : undefined;
    }, textStatus);

    return sentMsg ? new Message(this, sentMsg) : undefined;
  }

  async getMessages(
    chatId: string,
    filter: GetChatMessagesFilter,
    pagination: PaginationParams,
  ) {
    const messages = await this.pupPage.evaluate(
      async (chatId, filter, pagination) => {
        pagination.limit ||= Infinity;
        pagination.offset ||= 0;

        const msgFilter = (m) => {
          if (m.isNotification) {
            return false;
          }
          if (
            filter['filter.fromMe'] != null &&
            m.id.fromMe !== filter['filter.fromMe']
          ) {
            return false;
          }
          if (
            filter['filter.timestamp.gte'] != null &&
            m.t < filter['filter.timestamp.gte']
          ) {
            return false;
          }
          if (
            filter['filter.timestamp.lte'] != null &&
            m.t > filter['filter.timestamp.lte']
          ) {
            return false;
          }
          if (filter['filter.ack'] != null && m.ack !== filter['filter.ack']) {
            return false;
          }
          return true;
        };

        // @ts-ignore
        const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
        let msgs = chat.msgs.getModelsArray().filter(msgFilter);

        while (msgs.length < pagination.limit + pagination.offset) {
          const loadedMessages =
            // @ts-ignore
            await window.Store.ConversationMsgs.loadEarlierMsgs(chat);
          if (!loadedMessages || loadedMessages.length == 0) break;

          msgs = [...loadedMessages.filter(msgFilter), ...msgs];
          msgs = msgs.sort((a, b) => b.t - a.t);

          // Check if the earliest message is already outside the timerange filter
          const earliest = msgs[msgs.length - 1];
          if (earliest.t < (filter['filter.timestamp.gte'] || Infinity)) {
            // Add only messages that pass the filter and stop loading more
            break;
          }
        }

        if (msgs.length > pagination.limit + pagination.offset) {
          // sort by t - new first
          msgs = msgs.sort((a, b) => b.t - a.t);
          msgs = msgs.slice(
            pagination.offset,
            pagination.limit + pagination.offset,
          );
        }

        // @ts-ignore
        return msgs.map((m) => window.WWebJS.getMessageModel(m));
      },
      chatId,
      filter,
      pagination,
    );

    return messages.map((m) => new Message(this, m));
  }
}
