export class ChatIDNotFoundForContactError extends Error {
  constructor(public sender: any) {
    super('Chat ID not found');
  }
}

export class PhoneNumberNotFoundInWhatsAppError extends Error {
  constructor(public phone: any) {
    super(`Phone number not found in WhatsApp: ${phone}`);
  }
}
