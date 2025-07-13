import ChatwootClient, {
  contact_update,
  public_contact_create_update_payload,
} from '@figuro/chatwoot-sdk';
import type { contact } from '@figuro/chatwoot-sdk/dist/models/contact';
import type { generic_id } from '@figuro/chatwoot-sdk/dist/models/generic_id';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import {
  ChatWootAPIConfig,
  ChatWootInboxAPI,
} from '@waha/apps/chatwoot/client/interfaces';
import { isJidCusFormat } from '@waha/utils/wa';
import * as lodash from 'lodash';

import { AttributeKey } from '../const';

export interface ContactResponse {
  data: generic_id & contact;
  sourceId: string;
}

export class ContactAPI {
  constructor(
    private config: ChatWootAPIConfig,
    private accountAPI: ChatwootClient,
    protected inboxAPI: ChatWootInboxAPI,
    private logger: ILogger,
  ) {}

  async searchByAnyID(chatId: string): Promise<ContactResponse | null> {
    const payload: any[] = [
      {
        attribute_key: AttributeKey.WA_CHAT_ID,
        filter_operator: 'equal_to',
        values: [chatId],
        attribute_model: 'standard',
        custom_attribute_type: '',
        query_operator: 'OR',
      },
      {
        attribute_key: AttributeKey.WA_JID,
        filter_operator: 'equal_to',
        values: [chatId],
        attribute_model: 'standard',
        custom_attribute_type: '',
        query_operator: 'OR',
      },
      {
        attribute_key: AttributeKey.WA_LID,
        filter_operator: 'equal_to',
        values: [chatId],
        attribute_model: 'standard',
        custom_attribute_type: '',
        query_operator: 'OR',
      },
      {
        attribute_key: 'identifier',
        filter_operator: 'equal_to',
        values: [chatId],
        attribute_model: 'standard',
        custom_attribute_type: '',
      },
    ];

    if (isJidCusFormat(chatId)) {
      // Search by phone
      let phone_number = chatId.split('@')[0];
      phone_number = phone_number.replace('+', '');
      payload[payload.length - 1].query_operator = 'OR';
      payload.push({
        attribute_key: 'phone_number',
        filter_operator: 'equal_to',
        values: [phone_number],
      });
    }

    const response: any = await this.accountAPI.contacts.filter({
      accountId: this.config.accountId,
      payload: payload as any,
    });

    const contacts = response.payload;
    if (contacts.length == 0) {
      return null;
    }
    const contact = contacts[0];
    const inboxes = lodash.filter(contact.contact_inboxes, {
      inbox: { id: this.config.inboxId },
    });
    if (inboxes.length == 0) {
      return null;
    }
    return {
      data: contact,
      sourceId: inboxes[0].source_id,
    };
  }

  public updateCustomAttributes(
    contact: generic_id & contact,
    attributes: any,
  ) {
    const update: contact_update = {
      custom_attributes: { ...contact.custom_attributes, ...attributes },
    };
    return this.accountAPI.contacts.update({
      id: contact.id,
      accountId: this.config.accountId,
      data: update,
    });
  }

  public async create(
    chatId: string,
    payload: public_contact_create_update_payload,
  ): Promise<ContactResponse> {
    const contact = await this.inboxAPI.contacts.create({
      inboxIdentifier: this.config.inboxIdentifier,
      data: payload,
    });
    this.logger.info(
      `Created contact for chat.id: ${chatId}, contact.id: ${contact.source_id}`,
    );
    const response: any = await this.accountAPI.contacts.get({
      accountId: this.config.accountId,
      id: contact.id,
    });
    return {
      data: response.payload,
      sourceId: contact.source_id,
    };
  }

  public updateAvatarUrlSafe(contactId, avatarUrl: string) {
    this.accountAPI.contacts
      .update({
        accountId: this.config.accountId,
        id: contactId,
        data: {
          avatar_url: avatarUrl,
        },
      })
      .catch((e) => {
        this.logger.warn(
          'Error updating avatar_url for contact.id: ' + contactId,
        );
        this.logger.warn(e);
      });
  }
}
