export class MessageError extends Error {
  action: string;
  details?: unknown;

  constructor(
    message: string,
    action: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'MessageError';
    this.action = action;
    this.details = details;
  }
}

export function logMessageError(error: MessageError) {
  console.error(
    `[Message Error] Action: ${error.action}\n` +
    `Message: ${error.message}\n` +
    `Details:`,
    error.details
  );
}
