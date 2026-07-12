import { renderGenerationCompleted } from "./generation-completed.js";
import { renderGenerationFailed } from "./generation-failed.js";
import { renderOtpVerification } from "./otp-verification.js";
import { renderWelcome } from "./welcome.js";
import type {
  EmailContent,
  EmailTemplateData,
  EmailTemplateId,
  EmailTemplateRenderer,
} from "./types.js";

const templates: {
  [K in EmailTemplateId]: EmailTemplateRenderer<K>;
} = {
  "otp-verification": renderOtpVerification,
  welcome: renderWelcome,
  "generation-completed": renderGenerationCompleted,
  "generation-failed": renderGenerationFailed,
};

export function renderEmailTemplate<T extends EmailTemplateId>(
  id: T,
  data: EmailTemplateData[T],
): EmailContent {
  return templates[id](data);
}

export type {
  EmailContent,
  EmailTemplateData,
  EmailTemplateId,
} from "./types.js";
