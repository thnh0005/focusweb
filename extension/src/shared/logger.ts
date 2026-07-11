const PREFIX = "[FocusOS Extension]";

export const logger = {
  info(message: string, data?: unknown) {
    console.info(PREFIX, message, data ?? "");
  },
  warn(message: string, data?: unknown) {
    console.warn(PREFIX, message, data ?? "");
  },
  error(message: string, data?: unknown) {
    console.error(PREFIX, message, data ?? "");
  },
};
