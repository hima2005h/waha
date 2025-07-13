import { Channel } from '@waha/structures/channels.dto';
import { ChatPictureResponse } from '@waha/structures/chats.dto';
import {
  ChatRequest,
  MessageFileRequest,
  MessageImageRequest,
  MessageTextRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
  WANumberExistResult,
} from '@waha/structures/chatting.dto';
import { SessionInfo } from '@waha/structures/sessions.dto';
import axios, { AxiosInstance } from 'axios';

export class WAHASelf {
  public client: AxiosInstance;

  constructor() {
    // Set 'X-Api-Key'
    const key = process.env.WAHA_API_KEY_PLAIN;
    const port =
      parseInt(process.env.PORT) ||
      parseInt(process.env.WHATSAPP_API_PORT) ||
      3000;
    const url = `http://localhost:${port}`;
    this.client = axios.create({
      baseURL: url,
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(url: string): Promise<Buffer> {
    const response = await this.client.get(url, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  async qr(session: string): Promise<Buffer> {
    const url = `/api/${session}/auth/qr`;
    return await this.fetch(url);
  }

  async screenshot(session: string): Promise<Buffer> {
    const url = `/api/screenshot?session=${session}`;
    return await this.fetch(url);
  }

  async restart(session: string): Promise<any> {
    const url = `/api/sessions/${session}/restart`;
    return await this.client.post(url);
  }

  async logout(session: string): Promise<any> {
    const url = `/api/sessions/${session}/logout`;
    return await this.client.post(url);
  }

  async stop(session: string): Promise<any> {
    const url = `/api/sessions/${session}/stop`;
    return await this.client.post(url);
  }

  async get(session: string): Promise<SessionInfo> {
    const url = `/api/sessions/${session}/`;
    return await this.client.get(url).then((response) => response.data);
  }

  async getContact(session: string, contactId: string) {
    const url = `/api/contacts`;
    const params = {
      session: session,
      contactId: contactId,
    };
    return await this.client
      .get(url, { params: params })
      .then((response) => response.data);
  }

  async contactCheckExists(
    session: string,
    phone: string,
  ): Promise<WANumberExistResult> {
    const url = `/api/contacts/check-exists`;
    const params = {
      phone: phone,
      session: session,
    };
    return await this.client
      .get(url, { params: params })
      .then((response) => response.data);
  }

  async getGroup(session: string, groupId: string) {
    const url = `/api/${session}/groups/${groupId}`;
    return await this.client.get(url).then((response) => response.data);
  }

  async getChannel(session: string, channelId: string): Promise<Channel> {
    const url = `/api/${session}/channels/${channelId}`;
    return await this.client.get(url).then((response) => response.data);
  }

  async getChatPicture(
    session: string,
    chatId: string,
  ): Promise<string | null> {
    const url = `/api/${session}/chats/${chatId}/picture`;
    return await this.client.get(url).then((response) => response.data?.url);
  }

  async sendText(body: MessageTextRequest): Promise<any> {
    const url = `/api/sendText`;
    return await this.client.post(url, body).then((response) => response.data);
  }

  async sendImage(body: MessageImageRequest): Promise<any> {
    const url = `/api/sendImage`;
    return await this.client.post(url, body).then((response) => response.data);
  }

  async sendVideo(body: MessageVideoRequest): Promise<any> {
    const url = `/api/sendVideo`;
    return await this.client.post(url, body).then((response) => response.data);
  }

  async sendVoice(body: MessageVoiceRequest): Promise<any> {
    const url = `/api/sendVoice`;
    return await this.client.post(url, body).then((response) => response.data);
  }

  async sendFile(body: MessageFileRequest): Promise<any> {
    const url = `/api/sendFile`;
    return await this.client.post(url, body).then((response) => response.data);
  }

  async deleteMessage(session: string, chatId: string, messageId: string) {
    const url = `/api/${session}/chats/${chatId}/messages/${messageId}`;
    return await this.client.delete(url).then((response) => response.data);
  }

  async startTyping(body: ChatRequest) {
    const url = `/api/startTyping`;
    return await this.client.post(url, body).then((response) => response.data);
  }

  async stopTyping(body: ChatRequest) {
    const url = `/api/stopTyping`;
    return await this.client.post(url, body);
  }

  async readMessages(session: string, chatId: string) {
    const url = `/api/${session}/chats/${chatId}/messages/read`;
    return await this.client.post(url).then((response) => response.data);
  }

  async findPNByLid(session: string, lid: string): Promise<string | null> {
    const url = `/api/${session}/lids/${lid}`;
    return await this.client.get(url).then((response) => response.data.pn);
  }

  async findLIDByPN(session: string, pn: string): Promise<string | null> {
    const url = `/api/${session}/lids/pn/${pn}`;
    return await this.client.get(url).then((response) => response.data.lid);
  }

  /**
   * Get the server version
   * @returns Server version information
   */
  async serverVersion(): Promise<any> {
    const url = `/api/server/version`;
    return await this.client.get(url).then((response) => response.data);
  }

  /**
   * Get the server status
   * @returns Server status information
   */
  async serverStatus(): Promise<any> {
    const url = `/api/server/status`;
    return await this.client.get(url).then((response) => response.data);
  }

  /**
   * Reboot the server
   * @param force Whether to force reboot (true) or gracefully reboot (false)
   * @returns Server stop response
   */
  async serverReboot(force: boolean = false): Promise<any> {
    const url = `/api/server/stop`;
    return await this.client
      .post(url, { force })
      .then((response) => response.data);
  }
}

export class WAHASessionAPI {
  constructor(
    private session: string,
    private api: WAHASelf,
  ) {}

  getContact(contactId: string): Promise<any> {
    return this.api.getContact(this.session, contactId);
  }

  contactCheckExists(phone: string): Promise<WANumberExistResult> {
    return this.api.contactCheckExists(this.session, phone);
  }

  getGroup(groupId: string): Promise<any> {
    return this.api.getGroup(this.session, groupId);
  }

  getChannel(channelId: string): Promise<Channel> {
    return this.api.getChannel(this.session, channelId);
  }

  getChatPicture(chatId: string): Promise<string | null> {
    return this.api.getChatPicture(this.session, chatId);
  }

  sendText(body: MessageTextRequest): Promise<any> {
    body.session = this.session;
    return this.api.sendText(body);
  }

  sendImage(body: MessageImageRequest): Promise<any> {
    body.session = this.session;
    return this.api.sendImage(body);
  }

  sendVideo(body: MessageVideoRequest): Promise<any> {
    body.session = this.session;
    return this.api.sendVideo(body);
  }

  sendVoice(body: MessageVoiceRequest): Promise<any> {
    body.session = this.session;
    return this.api.sendVoice(body);
  }

  sendFile(body: MessageFileRequest): Promise<any> {
    body.session = this.session;
    return this.api.sendFile(body);
  }

  deleteMessage(chatId: string, messageId: string) {
    return this.api.deleteMessage(this.session, chatId, messageId);
  }

  startTyping(body: ChatRequest) {
    body.session = this.session;
    return this.api.startTyping(body);
  }

  stopTyping(body: ChatRequest) {
    body.session = this.session;
    return this.api.stopTyping(body);
  }

  readMessages(chatId: string) {
    return this.api.readMessages(this.session, chatId);
  }

  //
  // Lids
  //
  findPNByLid(lid: string) {
    return this.api.findPNByLid(this.session, lid);
  }

  findLIDByPN(pn: string) {
    return this.api.findLIDByPN(this.session, pn);
  }
}
