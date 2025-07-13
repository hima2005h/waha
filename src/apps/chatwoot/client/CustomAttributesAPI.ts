import ChatwootClient from '@figuro/chatwoot-sdk';
import { ChatWootAccountAPIConfig } from '@waha/apps/chatwoot/client/interfaces';
import {
  CustomAttributeModel,
  CustomAttributeType,
} from '@waha/apps/chatwoot/client/types';

export interface CustomAttribute {
  key: string;
  name: string;
  type: CustomAttributeType;
  description: string;
  model: CustomAttributeModel;
}

export class CustomAttributesAPI {
  constructor(
    private config: ChatWootAccountAPIConfig,
    private accountAPI: ChatwootClient,
  ) {}

  async upsert(attribute: CustomAttribute): Promise<void> {
    const attributes = await this.accountAPI.customAttributes.list({
      accountId: this.config.accountId,
      attributeModel: String(attribute.model) as '0' | '1',
    });
    const existing = attributes.find((a) => a.attribute_key === attribute.key);

    if (existing) {
      await this.accountAPI.customAttributes.update({
        accountId: this.config.accountId,
        id: existing.id,
        data: {
          attribute_key: attribute.key,
          attribute_display_name: attribute.name,
          attribute_display_type: attribute.type,
          attribute_description: attribute.description,
        },
      });
    } else {
      await this.accountAPI.customAttributes.create({
        accountId: this.config.accountId,
        data: {
          attribute_key: attribute.key,
          attribute_display_name: attribute.name,
          attribute_display_type: attribute.type,
          attribute_description: attribute.description,
          attribute_model: attribute.model,
        },
      });
    }
  }
}
