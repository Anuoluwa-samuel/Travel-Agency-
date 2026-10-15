import "server-only";
import { logger } from "@/server/lib/logger";
import type { EmailProvider } from "./types";

/**
 * Development-only adapter: prints the message (including links) to the server log so flows
 * like email verification can be completed locally. Reports `delivered: false` honestly.
 */
export const consoleEmailProvider: EmailProvider = {
  key: "console",
  simulated: true,
  async send(message) {
    // Recipients are redacted by the logger; the body is printed because it carries the link
    // a developer needs to click. Never enabled in production (see ./index.ts).
    logger.info({ subject: message.subject }, `[email:console] to=<redacted>\n${message.text}`);
    return { provider: "console", providerMessageId: null, delivered: false };
  },
};
